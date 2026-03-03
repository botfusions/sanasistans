import { GmailService } from './src/utils/gmail.service';
import { OrderService } from './src/utils/order.service';

async function test() {
  const order = new OrderService();
  const gmail = new GmailService();
  
  await gmail.processUnreadMessages(async (content, subject, isExcel) => {
    console.log("Processing email:", subject, isExcel ? "(Excel)" : "(Text)");
    try {
      const parse = await order.parseAndCreateOrder(content, subject, isExcel);
      console.log("Parsed order:", JSON.stringify(parse, null, 2));
      return parse ? order.getVisualSummary(parse) + "\n" + order.getRoutingMentions(parse) : 'Hata';
    } catch (e) {
      console.error(e);
      return 'Hata';
    }
  });
}
test().catch(console.error);
