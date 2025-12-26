export type NameProto = {
  key: string
  label: string
  icon: string
  url: string
}

const norm = (s: string) =>
  (s || '')
    .trim()
    .toLowerCase()
    .replace(/\.svg$/i, '')
    .replace(/\s+/g, '-')

const byKey: Record<string, NameProto> = {}

const add = (p: NameProto) => {
  byKey[norm(p.key)] = p
  byKey[norm(p.label)] = p
  byKey[norm(p.icon)] = p
}

// add only the ones you need first
add({
  key: 'dinero',
  label: 'Dinero',
  icon: 'Dinero',
  url: 'https://dinero.xyz',
})

add({
  key: 'Nado',
  label: 'nado',
  icon: 'nado',
  url: 'https://app.nado.xyz/',
})

add({
  key: 'curve',
  label: 'Curve',
  icon: 'curve',
  url: 'https://curve.fi',
})

add({
  key: 'stargate',
  label: 'Stargate',
  icon: 'stargate finance',
  url: 'https://stargate.finance',
})

add({
  key: 'velodrome',
  label: 'Velodrome',
  icon: 'velodrome',
  url: 'https://velodrome.finance',
})

add({
  key: 'ionic',
  label: 'Ionic',
  icon: 'ionic protocol',
  url: 'https://ionic.money',
})

add({
  key: 'makina',
  label: 'Makina',
  icon: 'makina finance',
  url: '',
})

add({
  key: 'tydro',
  label: 'Tydro',
  icon: 'tydro',
  url: '',
})

add({
  key: 'the deep',
  label: 'The Deep',
  icon: 'the deep',
  url: '',
})

add({
  key: 'frax',
  label: 'Frax',
  icon: 'frax',
  url: 'https://frax.finance',
})

add({
  key: 'aave',
  label: 'Aave',
  icon: 'aave',
  url: 'https://aave.com',
})

add({
  key: 'pwn',
  label: 'PWN',
  icon: 'pwn',
  url: '',
})

add({
  key: 'exactly',
  label: 'Exactly',
  icon: 'exactly protocol',
  url: '',
})

add({
  key: 'shroomy',
  label: 'Shroomy',
  icon: 'shroomy',
  url: '',
})

add({
  key: 'inkdca',
  label: 'InkDCA',
  icon: 'inkdca',
  url: '',
})

add({
  key: 'staked',
  label: 'Staking',
  icon: 'staking',
  url: '',
})

export function getProtocolByName(name: string | null | undefined): NameProto | null {
  const k = norm(name || '')
  return k ? byKey[k] || null : null
}
