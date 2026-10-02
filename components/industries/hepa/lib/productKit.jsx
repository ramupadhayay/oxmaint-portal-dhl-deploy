'use client'

// The product's chrome, which now lives in the general CMMS portal.
//
// It was written here, against the live Inspection screens, and then the same
// four screens were wanted in the general portal. Copying it would have given
// two kits that drift; the pharmaceutical portal is a customer's copy of the
// product, not the product, so the kit moved to the portal that is, and this
// re-exports it under the path twenty-odd screens here already import.

export * from '../../oxmaint/lib/productKit'
