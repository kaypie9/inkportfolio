import EcosystemGrid from '@/app/components/ecosystem/EcosystemGrid'
import { inkEcosystem } from '@/app/data/ink-ecosystem'

export const dynamic = 'force-dynamic'

export default function EcosystemPage() {
  return (
<main className='eco-page mx-auto w-full max-w-6xl px-4 py-8'>
      <div className='mb-6'>
        <h1 className='text-2xl font-semibold text-white'>Ink ecosystem</h1>
        <p className='mt-1 text-sm text-white/60'>
          Curated, trusted apps on Ink.
        </p>
      </div>

      <EcosystemGrid items={inkEcosystem} />
    </main>
  )
}
