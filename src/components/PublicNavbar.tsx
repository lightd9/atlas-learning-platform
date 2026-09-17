"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, Menu, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Logo from "@/components/Logo";
import CookieConsent from "@/components/CookieConsent";
import { categoryId, publicCourses, publicCourseCategories } from "@/data/publicCourses";

export default function PublicNavbar() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [mobileExploreOpen, setMobileExploreOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [searchCourses, setSearchCourses] = useState(publicCourses);
  const exploreRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/public/home-content', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null).then((content) => {
      const explore = content?.EXPLORE ?? [];
      if (explore.length) setSearchCourses([...publicCourses, ...explore.filter((course: any) => !publicCourses.some((fallback) => fallback.title === course.title)).map((course: any) => ({ title: course.title, category: course.section?.name ?? 'Course', duration: `${course.durationMinutes ?? 0} min`, lessons: 0, status: 'available' as const, image: course.coverImageUrl || `/api/public/course-thumbnail/${course.id}` }))]);
    }).catch(() => {});
  }, []);

  const closeMenu = () => setMenuOpen(false);

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = query.trim();
    router.push(term ? `/explore?q=${encodeURIComponent(term)}` : "/explore");
    setQuery("");
    setFocused(false);
    setMenuOpen(false);
  };

  const term = query.trim().toLowerCase();
  const results = term
    ? searchCourses
        .filter((course) =>
          (course.title + " " + course.category).toLowerCase().includes(term),
        )
        .slice(0, 6)
    : [];
  const showResults = focused && term.length > 0;

  useEffect(() => {
    const closeSearch = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setFocused(false);
    };
    document.addEventListener("mousedown", closeSearch);
    return () => document.removeEventListener("mousedown", closeSearch);
  }, []);

  useEffect(() => {
    const closeExplore = (event: MouseEvent) => {
      if (!exploreRef.current?.contains(event.target as Node)) setExploreOpen(false);
    };
    document.addEventListener("mousedown", closeExplore);
    return () => document.removeEventListener("mousedown", closeExplore);
  }, []);

  return (
    <>
      <header className="atlas-public-header">
        <Link
          href="/"
          className="atlas-public-brand"
          aria-label="Atlas Learning home"
          onClick={closeMenu}
        >
          <Logo />
        </Link>
        <div className="atlas-search-wrap" ref={searchRef}>
          <form className="atlas-public-search" role="search" onSubmit={submitSearch}>
            <Search size={14} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setFocused(true)}
              placeholder="Search courses"
              aria-label="Search courses"
              aria-expanded={showResults}
              aria-controls="atlas-search-results"
            />
          </form>
          {showResults && (
            <div
              id="atlas-search-results"
              className="atlas-search-results"
              role="listbox"
              aria-label="Search results"
            >
              <p>{results.length === 0 ? "No matches" : "Suggested courses"}</p>
              {results.map((course) => (
                <Link
                  key={course.title}
                  href={`/explore?q=${encodeURIComponent(course.title)}`}
                  onClick={() => {
                    setQuery("");
                    setFocused(false);
                  }}
                >
                  <span>{course.title}</span>
                  <small>{course.category}</small>
                </Link>
              ))}
            </div>
          )}
        </div>
        <nav className="atlas-public-nav" aria-label="Primary navigation">
          <div className="atlas-explore-menu" ref={exploreRef}>
            <Link href="/explore" className="atlas-explore-link">Explore</Link>
            <button
              type="button"
              className="atlas-explore-trigger"
              onClick={() => setExploreOpen((open) => !open)}
              aria-expanded={exploreOpen}
              aria-controls="atlas-explore-dropdown"
              aria-label="Browse course categories"
            >
              <ChevronDown size={15} aria-hidden="true" />
            </button>
            {exploreOpen && (
              <div id="atlas-explore-dropdown" className="atlas-explore-dropdown" role="menu">
                <p>Browse by category</p>
                <Link href="/explore" onClick={() => setExploreOpen(false)}>
                  All courses
                </Link>
                {publicCourseCategories.map((category) => (
                  <Link
                    key={category}
                    href={`/explore#${categoryId(category)}`}
                    onClick={() => setExploreOpen(false)}
                  >
                    {category}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <Link href="/school/analytics" className="atlas-analysis-link">
            School Analysis
          </Link>
          <Link href="/about">About Atlas</Link>
        </nav>
        <div className="atlas-public-actions">
          <span>EN</span>
          <Bell size={15} aria-hidden="true" />
          <Link className="atlas-sign-in" href="/login">
            Sign in
          </Link>
        </div>
        <button
          className="atlas-menu-button"
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="atlas-mobile-navigation"
          aria-label="Toggle navigation"
        >
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </header>

      {menuOpen && (
        <nav
          id="atlas-mobile-navigation"
          className="atlas-mobile-navigation"
          aria-label="Mobile navigation"
        >
          <div className="atlas-mobile-explore">
            <div className="atlas-mobile-explore-row">
              <Link href="/explore" onClick={closeMenu}>Explore courses</Link>
              <button
                type="button"
                onClick={() => setMobileExploreOpen((open) => !open)}
                aria-expanded={mobileExploreOpen}
                aria-controls="atlas-mobile-category-links"
                aria-label="Browse course categories"
              >
                <ChevronDown size={16} aria-hidden="true" />
              </button>
            </div>
            {mobileExploreOpen && <div id="atlas-mobile-category-links" className="atlas-mobile-category-links">
              <Link href="/explore" onClick={closeMenu}>All courses</Link>
              {publicCourseCategories.map((category) => (
                <Link key={category} href={`/explore#${categoryId(category)}`} onClick={closeMenu}>
                  {category}
                </Link>
              ))}
            </div>}
          </div>
          <Link href="/school/analytics" onClick={closeMenu}>
            School Analysis
          </Link>
          <Link href="/about" onClick={closeMenu}>
            About Atlas
          </Link>
          <Link className="atlas-blue-button" href="/login" onClick={closeMenu}>
            Log in
          </Link>
        </nav>
      )}
      <CookieConsent />
    </>
  );
}
