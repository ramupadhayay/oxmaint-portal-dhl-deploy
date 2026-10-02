// Which pack brings a real dataset, and only in the build that runs that pack.
//
// A pack is otherwise a list of names the generators turn into a plant. DHL's
// arrives as a five-year workbook instead — close to a megabyte once imported —
// and every other build must not carry it. A static import would: the bundle
// follows the import whether or not the value is used.
//
// So the dataset is required behind the pack key. NEXT_PUBLIC_OXMAINT_PACK is
// inlined as a string at build time, the condition folds to false in every other
// build, and the branch — require included — is removed before bundling. The
// build check that proves this greps the other builds' output for a DHL asset id.

const KEY = process.env.NEXT_PUBLIC_OXMAINT_PACK

// eslint-disable-next-line global-require
export const buildDataset = KEY === 'dhl-gse' ? require('./dhl-gse-data').buildDataset : null
