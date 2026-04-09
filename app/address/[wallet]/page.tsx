import HomePage from '@/app/page'

export const metadata = {
  title: 'On-Chain Address Data',
  robots: {
    index: false,
    follow: false,
  },
}

export default function AddressPage() {
  return <HomePage disableWalletCTA isPublicAddressPage />
}