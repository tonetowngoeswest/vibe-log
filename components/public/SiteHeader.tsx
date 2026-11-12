import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { SessionControls } from "@/components/auth/SessionControls";
import { HeaderNav } from "./HeaderNav";
import { ThemeToggle } from "./ThemeToggle";

export async function SiteHeader() {
  const viewer = await getViewer();
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header">
      <div className="masthead"><div className="masthead-inner">
        <p className="edition">Kansas City football<br /><span>Independent coverage</span></p>
        <Link className="wordmark" href="/" aria-label="Chiefs News home">CHIEFS<span>NEWS</span></Link>
        <img className="masthead-logo" src="/chiefs-logo.png" alt="Kansas City Chiefs logo" width={112} height={112} />
      </div></div>
      <div className="navigation"><div className="navigation-inner">
        <Link className="compact-brand" href="/" aria-label="Chiefs News home"><img src="/chiefs-logo.png" alt="" width={48} height={48} /><span>CHIEFS NEWS</span></Link>
        <HeaderNav />
        <div className="header-controls"><ThemeToggle /><SessionControls viewer={viewer} /></div>
      </div></div>
    </header>
  </>;
}
