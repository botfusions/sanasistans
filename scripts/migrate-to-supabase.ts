import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { SupabaseService } from '../src/utils/supabase.service';

/**
 * JSON verilerini Supabase Postgres veritabanına taşıyan script.
 */
async function migrate() {
  console.log('🚀 Migrasyon başlıyor...');
  const supabase = SupabaseService.getInstance();

  const dataPath = path.resolve(process.cwd(), 'data');
  const ordersPath = path.join(dataPath, 'orders.json');
  const staffPath = path.join(dataPath, 'staff.json');

  // 1. Personel Taşınması
  if (fs.existsSync(staffPath)) {
    console.log('👥 Personel verileri taşınıyor...');
    const staff = JSON.parse(fs.readFileSync(staffPath, 'utf8'));
    for (const member of staff) {
      try {
        // Eğer id yoksa veya UUID değilse telegram_id'den bir UUID üret
        if (!member.id || member.id.length < 10) {
          const hash = crypto.createHash('sha256').update(member.telegramId.toString()).digest('hex');
          member.id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
        }
        await supabase.upsertStaff(member);
        console.log(`✅ Personel eklendi: ${member.name}`);
      } catch (err) {
        console.error(`❌ Personel hatası (${member.name}):`, err);
      }
    }
  }

  // 2. Siparişler ve Kalemler Taşınması
  if (fs.existsSync(ordersPath)) {
    console.log('📦 Sipariş verileri taşınıyor...');
    const orders = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
    
    for (const order of orders) {
      try {
        // Siparişi ekle
        await supabase.upsertOrder(order);
        console.log(`📝 Sipariş eklendi: ${order.orderNumber || order.id}`);

        // Kalemleri ekle
        if (order.items && Array.isArray(order.items)) {
          let idx = 0;
          for (const item of order.items) {
            try {
              await supabase.upsertOrderItem(item, order.id, idx++);
            } catch (err) {
              console.error(`❌ Kalem hatası (${item.product}):`, err);
            }
          }
          console.log(`   └─ ${order.items.length} kalem taşındı.`);
        }
      } catch (err) {
        console.error(`❌ Sipariş hatası (${order.id}):`, err);
      }
    }
  }

  console.log('🏁 Migrasyon tamamlandı!');
}

migrate().catch(console.error);
