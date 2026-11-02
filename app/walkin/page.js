import BookingIntakePage from '@/components/BookingIntakePage';

// Walk-in link / QR code: /walkin?s=<studio id>
export default function WalkInPage() {
  return <BookingIntakePage mode="walkin" />;
}
