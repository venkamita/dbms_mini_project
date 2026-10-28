import './globals.css';
export const metadata = { title: 'GameMatch', description: 'Find your next game. Understand every recommendation.' };
export default function RootLayout({ children }) {
  return <html lang="en"><body><header><nav><a className="brand" href="/catalog">◈ GameMatch</a><a href="/catalog">Catalog</a></nav></header><main>{children}</main><footer>GameMatch · Explainable recommendations · DBMS project</footer></body></html>;
}
