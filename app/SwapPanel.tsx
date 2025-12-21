'use client'

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
      subvariant: 'split',
      appearance: 'dark',
      hiddenUI: ['appearance'],

          // 👇 DEFAULT FROM = ink ETH
    fromChain: 57073,
    fromToken: '0x0000000000000000000000000000000000000000',

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
              primary: { main: '#30007A' },
              secondary: { main: '#8700B8' },
              background: { default: '#F9F5FF', paper: '#FFFFFF' },
              text: { primary: '#000000', secondary: '#818084' },
              grey: {
                200: '#ECEBF0',
                300: '#E5E1EB',
                700: '#70767A',
                800: '#4B4F52',
              },
              playground: { main: '#F3EBFF' },
            },
          },
          dark: {
            palette: {
              primary: { main: '#653BA3' },
              secondary: { main: '#D35CFF' },
              background: { default: '#24203D', paper: '#302B52' },
              text: { primary: '#ffffff', secondary: '#9490a5' },
              grey: {
                200: '#ECEBF0',
                300: '#DDDCE0',
                700: '#70767A',
                800: '#3c375c',
              },
              playground: { main: '#120F29' },
            },
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
