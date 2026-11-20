import LegalDoc from '../../components/LegalDoc';
import { OFFER_EDITION } from '../../lib/legal';
import { OFFER_LEAD, OFFER_SECTIONS, OFFER_TITLE } from '../../lib/merchant-offer';

export const metadata = { title: 'Публичная оферта для магазинов — Kartop', robots: { index: true } };

// Принимается владельцем в приложении «Kartop для магазина» (код из SMS), ЭЦП или на бумаге (заявка с фото договора).
export default function MerchantOfferPage() {
  return <LegalDoc edition={OFFER_EDITION} title={OFFER_TITLE} lead={OFFER_LEAD} sections={OFFER_SECTIONS} />;
}
