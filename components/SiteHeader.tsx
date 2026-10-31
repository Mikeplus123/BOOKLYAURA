"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { Icon } from "./Icon";
import { Logo } from "./Logo";

const NAV = [
  { href: "/", label: "Bosh sahifa", icon: "home" },
  { href: "/library", label: "Kutubxona", icon: "library" },
  { href: "/me", label: "Mening darslarim", icon: "bookmark" },
  { href: "/premium", label: "Premium", icon: "star" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <a href="#main" className="skip-link">
        Asosiy qismga o‘tish
      </a>
      <header className="site-header">
        <div className="container header-inner">
          <Link href="/" aria-label="Bookly — bosh sahifa">
            <Logo />
          </Link>
          <nav className="top-nav" aria-label="Asosiy menyu">
            {NAV.slice(1).map((n) => (
              <Link key={n.href} href={n.href} className={isActive(n.href) ? "is-active" : ""} aria-current={isActive(n.href) ? "page" : undefined}>
                {n.label}
              </Link>
            ))}
          </nav>
          <AccountButton />
        </div>
      </header>
      <nav className="bottom-nav" aria-label="Pastki menyu">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={isActive(n.href) ? "is-active" : ""} aria-current={isActive(n.href) ? "page" : undefined}>
            <Icon name={n.icon} size={22} />
            <span>{n.label === "Mening darslarim" ? "Darslarim" : n.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}

function AccountButton() {
  const { enabled, loading, user, profile, isAdmin, isPremium, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  if (!enabled) {
    return (
      <Link href="/library" className="btn btn-primary btn-sm header-cta">
        Boshlash
      </Link>
    );
  }
  if (loading) return <span className="avatar-skeleton" aria-hidden />;
  if (!user) {
    return (
      <Link href="/login" className="btn btn-soft btn-sm">
        Kirish
      </Link>
    );
  }
  const name = profile?.display_name ?? user.email ?? "Hisob";
  const avatar = profile?.avatar_url ?? (user.user_metadata?.avatar_url as string | undefined);
  return (
    <div className="account" ref={ref}>
      <button type="button" className="avatar-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {avatar ? <Image src={avatar} alt="" width={34} height={34} className="avatar" /> : <span className="avatar avatar-letter">{name[0]?.toUpperCase()}</span>}
        {isPremium && <span className="avatar-star" aria-label="Premium">★</span>}
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-head">
            <strong>{name}</strong>
            <small>{user.email}</small>
          </div>
          <Link href="/me" role="menuitem" onClick={() => setOpen(false)}>
            <Icon name="bookmark" /> Mening darslarim
          </Link>
          <Link href="/premium" role="menuitem" onClick={() => setOpen(false)}>
            <Icon name="star" /> {isPremium ? "Premium a’zolik" : "Premium"}
          </Link>
          {isAdmin && (
            <Link href="/admin" role="menuitem" onClick={() => setOpen(false)}>
              <Icon name="settings" /> Kontent boshqaruvi
            </Link>
          )}
          <button type="button" role="menuitem" onClick={signOut}>
            <Icon name="logout" /> Chiqish
          </button>
        </div>
      )}
    </div>
  );
}
