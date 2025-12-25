'use client'

import React, { useEffect } from 'react'

export default function NoWalletOverlay(props: {
  show: boolean
  onConnect: () => void
  onGoMetrics: () => void
  onClose?: () => void
}) {
  const { show, onConnect, onGoMetrics, onClose } = props

    useEffect(() => {
    if (!show) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [show, onClose])

  if (!show) return null

return (
  <div
    className='ink-emptywrap'
    role='dialog'
    aria-modal='true'
    onClick={() => onClose?.()}
  >
    <div className='ink-emptyglass' />
    <div className='ink-emptycard' onClick={e => e.stopPropagation()}>

        <button
          type='button'
          className='ink-emptyclose'
          aria-label='Close'
          onClick={() => onClose?.()}
        >
          ×
        </button>

        <div className='ink-emptyicon' aria-hidden='true'>
  <img
    src='/ink-logo-purple-white-icon.svg'
    alt='Ink'
    className='ink-emptylogo'
  />
</div>

  <div className='ink-emptytitle'>Track your Ink portfolio</div>

        <div className='ink-emptysub'>
          Live balances, DeFi positions, NFTs, and key network metrics, all in one place
        </div>

        <div className='ink-emptyactions'>
          <button type='button' className='ink-emptybtn primary' onClick={onConnect}>
            Connect wallet
          </button>

          <button type='button' className='ink-emptybtn ghost' onClick={onGoMetrics}>
            View Ink Metrics
          </button>
        </div>
        <div className='ink-emptyreassure'>Viewing portfolios is read-only. No transactions or approvals.</div>

        <div className='ink-emptyhint'>
          You can paste any wallet address or .ink domain in the top search bar. Connecting a wallet is optional.
        </div>
      </div>
    </div>
  )
}
