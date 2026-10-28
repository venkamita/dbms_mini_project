import './globals.css';
import { SessionProvider } from './components/session';
export const metadata = { title: 'GameMatch', description: 'Find your next game. Understand every recommendation.' };
export default function RootLayout({ children }) {
  return <html lang="en"><body><SessionProvider><main>{children}</main></SessionProvider><footer>GameMatch · Explainable recommendations · DBMS project</footer></body></html>;
}
