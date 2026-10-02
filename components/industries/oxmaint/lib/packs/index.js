// Which demo this portal is running.
//
// A pack is the whole customer: their name, sites, plant, failure modes, stores
// and — where they have one — a specialised module. Everything else in the
// portal is generated from it, so swapping demos is this one constant rather
// than an edit across 56 screens.
//
// The switch is deliberately a build-time constant rather than a runtime
// setting. A pack changes what the seeded plant *is*, and letting that change
// under a running session would leave stored records pointing at assets that no
// longer exist.

import generic from './generic'
import chiller from './chiller'
import hospitality from './hospitality'
import dhlGse from './dhl-gse'
import nestle from './nestle'
import humanoid from './humanoid'
import hospitalFls from './hospital-fls'
import tyrePlant from './tyre-plant'

export const PACKS = {
  generic, chiller, hospitality, 'dhl-gse': dhlGse, nestle, humanoid, 'hospital-fls': hospitalFls, 'tyre-plant': tyrePlant,
}

// `NEXT_PUBLIC_OXMAINT_PACK` overrides it for a deployment that needs a
// different demo without a code change.
const requested = process.env.NEXT_PUBLIC_OXMAINT_PACK

export const ACTIVE_KEY = PACKS[requested] ? requested : 'chiller'
export const PACK = PACKS[ACTIVE_KEY]

export default PACK
