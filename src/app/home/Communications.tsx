import ProductScreenshots, { type ProductScreen } from "./ProductScreenshots";

const screens: readonly ProductScreen[] = [
  { id: "whatsapp", label: "WhatsApp delivery", moment: "The same visit, beyond the front desk", title: "Know the difference between sent and delivered.", description: "The actual WhatsApp panel shows templates, queued messages and provider delivery states. In this example, the queue update for Anaya’s fictional recipient ending 0041 is delivered; another message is accepted and one has failed.", alt: "Actual WhatsApp delivery workspace with illustrative approved templates and delivered, accepted, read and failed message states." },
  { id: "notifications", label: "Team notifications", moment: "A shared view of what needs attention", title: "Updates reach the team inside their workspace.", description: "The real notification inbox brings Anaya’s arrival and recorded payment together with booking and team updates. Categories and unread states help staff find the context they need.", alt: "Actual notifications inbox showing fictional Anaya Sen arrival, payment, other booking and clinic-team updates." },
];

export default function Communications() {
  return <ProductScreenshots screens={screens} audience="communications" />;
}
