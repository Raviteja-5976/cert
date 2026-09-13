import Image from "next/image";
import Link from "next/link";
import logo from "../../assets/DevTrackAcademy-logo.png";
import gni from "../../assets/gni-logo.png";
import ieee from "../../assets/ieee-cs.png";
import jubilee from "../../assets/silver-jublee.png";
import anniversary from "../../assets/80aniversary.png";

export function SiteHeader({ chip, children }: { chip: string; children?: React.ReactNode }) {
  return (
    <header className="site-header">
      <Link href="/certificate" className="brand">
        <Image src={logo} alt="DevTrackAcademy" priority />
        <span>
          DevTrack<span>Academy</span>
        </span>
      </Link>
      <span className="brand-chip">{chip}</span>
      {children}
    </header>
  );
}

export function PartnerStrip() {
  return (
    <section className="partner-strip">
      <span>IN ASSOCIATION WITH</span>
      <Image src={gni} alt="Guru Nanak Institutions" />
      <Image src={ieee} alt="IEEE Computer Society, GNITC Student Branch" />
      <Image src={jubilee} alt="Guru Nanak Institutions Silver Jubilee" />
      <Image src={anniversary} alt="IEEE Computer Society 80th Anniversary" />
    </section>
  );
}
