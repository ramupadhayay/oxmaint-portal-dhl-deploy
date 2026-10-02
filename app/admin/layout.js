// Server component so the console can name itself in the tab. The page it
// wraps is a client component and stays one.
export const metadata = {
  title: 'Oxmaint AI · Admin',
  description: 'Oxmaint AI — admin console sign-in.',
}

export default function AdminLayout({ children }) {
  return children
}
