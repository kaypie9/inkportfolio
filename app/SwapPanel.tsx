'use client'

import('@lifi/widget')
import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import type { WidgetConfig } from '@lifi/widget'

function SwapLoading() {
  return (
    <div className='swap-loading-wrap'>
      <div className='swap-loading-card'>
        <div className='swap-loading-top'>
          <div className='swap-skel swap-skel-title' />
          <div className='swap-skel swap-skel-pill' />
        </div>
        <div className='swap-loading-body'>
          <div className='swap-skel swap-skel-row' />
          <div className='swap-skel swap-skel-row' />
          <div className='swap-skel swap-skel-row-sm' />
          <div className='swap-skel swap-skel-btn' />
        </div>
        <div className='swap-loading-foot'>
          <div className='swap-skel swap-skel-foot' />
        </div>
      </div>
    </div>
  )
}

const LiFiWidget = dynamic(
  () => import('@lifi/widget').then((mod) => mod.LiFiWidget),
  { ssr: false, loading: () => <SwapLoading /> }
) as any

export default function SwapPanel() {
  const config: WidgetConfig = useMemo(
    () => ({

      integrator: 'ink-dashboard',

      variant: 'wide',
      subvariant: "default",
      appearance: 'dark',
      hiddenUI: ['appearance'],

// 👇 DEFAULT TO = Ink ETH
toChain: 57073,
toToken: '0x0000000000000000000000000000000000000000',

      theme: {
        typography: {},
        container: {
          boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.12)',
          borderRadius: '24px',
        },
        shape: {
          borderRadius: 16,
          borderRadiusSecondary: 16,
        },
        colorSchemes: {
          light: {
        palette: {
          primary: {
            main: "#5C67FF"
          },
          secondary: {
            main: "#F7C2FF"
          }
        }
      },
          dark: {
        palette: {
          primary: {
            main: "#5C67FF"
          },
          secondary: {
            main: "#F7C2FF"
          }
        }
      },
        },
        components: {
          MuiCard: {
            defaultProps: { variant: 'elevation' },
          },
        },
      },

      walletConfig: {
        onConnect: () => {},
      },
    }),
    []
  )

  return (
    <div className='swap-widget-wide'>
      <LiFiWidget integrator='ink-dashboard' config={config} />
    </div>
  )
}
