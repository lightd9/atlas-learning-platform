"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock3,
  FileBadge2,
  FolderUp,
  GraduationCap,
  Heart,
  MessageCircleMore,
  School,
  Star,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import PublicFooter from "@/components/PublicFooter";
import PublicNavbar from "@/components/PublicNavbar";
import { publicCourseFromPlacement, type PublicCourse, type PublicHomeCourse } from "@/data/publicCourses";
import CourseCoverImage from "@/components/CourseCoverImage";

/* Restore the first slide by uncommenting the block below and removing the current first slide */
const slides = [
  // {
  //   title: (
  //     <>
  //       Upgrade your skills
  //       <br />
  //       for a better future
  //     </>
  //   ),
  //   copy: "Clear, accessible learning built for teachers, school leaders and support teams.",
  //   image: "/hero-1.png",
  //   alt: "A confident learner celebrating her progress",
  //   variant: "reference",
  // },
  {
    title: (
      <>
        Helping schools build
        <br />
        <span>digital confidence.</span>
      </>
    ),
    copy: "Short, practical online learning for teachers, school leaders and the people who make schools work.",
    image: "/hero-2.avif",
    alt: "Education professionals learning together",
    variant: "current",
  },
  {
    title: (
      <>
        A stronger digital future
        <br />
        starts with your team.
      </>
    ),
    copy: "Give every member of your school practical skills, shared language and visible progress.",
    image: "/hero-3.jpg",
    alt: "A school team collaborating around a table",
    variant: "team",
  },
] as const;

const benefits = [
  [
    GraduationCap,
    "Learn anywhere",
    "Access short, practical learning from school or home.",
  ],
  [
    School,
    "School-based examples",
    "Understand new ideas through familiar education scenarios.",
  ],
  [
    MessageCircleMore,
    "Clear guidance",
    "Build confidence with jargon-free explanations and support.",
  ],
  [
    CalendarDays,
    "Flexible schedules",
    "Learn at a pace that works around a busy school day.",
  ],
  [
    FileBadge2,
    "Recognise progress",
    "Complete each pathway and celebrate professional development.",
  ],
  [
    FolderUp,
    "Growing library",
    "Keep developing as new digital learning resources are added.",
  ],
] as const;

const roadmap = [
  "AI Foundations",
  "Responsible AI",
  "Practical AI",
  "Microsoft 365",
  "Cybersecurity",
  "Digital Productivity",
  "Data Protection",
  "Cloud Technology",
  "School Leadership",
  "Compliance",
  "Digital Transformation",
  "More coming soon",
];

const reviews = [
  [
    "This course gives a clear, practical introduction without assuming technical knowledge. The school-based examples make every topic immediately useful.",
    "Helen Ward",
    "School Business Manager",
  ],
  [
    "The learning is concise, relevant and easy to fit around a busy day. I came away with actions I could use with my team straight away.",
    "Daniel Okoro",
    "Headteacher",
  ],
  [
    "A thoughtful explanation of responsible AI that balances opportunity with safeguarding, privacy and professional judgement.",
    "Rebecca James",
    "Designated Safeguarding Lead",
  ],
  [
    "The content is friendly and reassuring. It helped our staff move from uncertainty to confidence in less than half an hour.",
    "Michael Evans",
    "Trust IT Lead",
  ],
] as const;

function Stars() {
  return (
    <span className="atlas-stars" aria-label="5 out of 5 stars">
      {[1, 2, 3, 4, 5].map((item) => (
        <Star key={item} size={12} fill="currentColor" />
      ))}
    </span>
  );
}

function BenefitIcon({ Icon }: { Icon: (typeof benefits)[number][0] }) {
  return (
    <span className="atlas-benefit-icon" aria-hidden="true">
      <Icon size={28} strokeWidth={1.7} />
    </span>
  );
}

export default function HomePage() {
  const [active, setActive] = useState(0);
  const [activeCategory, setActiveCategory] = useState("All courses");
  const slide = slides[active];
  const [managedFeaturedCourses, setManagedFeaturedCourses] = useState<PublicCourse[]>([]);
  const [managedRecommendations, setManagedRecommendations] = useState<PublicCourse[]>([]);
  const [managedSkills, setManagedSkills] = useState<PublicCourse[]>([]);
  const [homeContentReady, setHomeContentReady] = useState(false);
  const [homeContentError, setHomeContentError] = useState('');

  const loadHomeContent = useCallback(() => {
    setHomeContentReady(false);
    setHomeContentError('');
    return fetch('/api/public/home-content', { cache: 'no-store' })
      .then((response) => { if (!response.ok) throw new Error('Unable to load courses. Please try again.'); return response.json(); })
      .then((content) => {
        const mapCourses = (courses: PublicHomeCourse[] = []) => courses.map(publicCourseFromPlacement);
        setManagedFeaturedCourses(mapCourses(content.TOP_COURSES));
        setManagedRecommendations(mapCourses(content.RECOMMENDED));
        setManagedSkills(mapCourses(content.UNLOCK_SOMETHING_NEW));
      })
      .catch((error) => setHomeContentError(error instanceof Error ? error.message : 'Unable to load courses. Please try again.'))
      .finally(() => setHomeContentReady(true));
  }, []);
  useEffect(() => { loadHomeContent(); }, [loadHomeContent]);

  const categoryCourses =
    activeCategory === "All courses"
      ? managedFeaturedCourses
      : managedFeaturedCourses.filter((course) => course.category === activeCategory);
  const homeCategories = ["All courses", ...Array.from(new Set(managedFeaturedCourses.map((course) => course.category)))];

  useEffect(() => {
    const timer = window.setInterval(
      () => setActive((current) => (current + 1) % slides.length),
      7000,
    );
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const revealables = Array.from(document.querySelectorAll<HTMLElement>(
      ".atlas-public-home main > section:not(.atlas-hero), .atlas-public-home main > footer",
    ));
    if (revealables.length === 0) return;
    if (!("IntersectionObserver" in window)) {
      revealables.forEach((element) => element.classList.add("is-visible"));
      return;
    }
    revealables.forEach((element) => element.classList.add("atlas-reveal"));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -8%" });
    revealables.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <div className={`atlas-public-home ${homeContentReady ? "atlas-content-ready" : "atlas-content-loading"}`}>
      <PublicNavbar />

      <main>
        {homeContentError && <p role="alert" className="atlas-course-load-error">{homeContentError} <button type="button" onClick={() => loadHomeContent()}>Retry</button></p>}
        <section
          className={`atlas-hero atlas-hero-${slide.variant}`}
          aria-roledescription="carousel"
          aria-label="Featured learning"
        >
          <div className="atlas-hero-copy" key={`copy-${active}`}>
            <h1>{slide.title}</h1>
            <p className="atlas-hero-description">{slide.copy}</p>
          </div>
          <div className="atlas-hero-art" key={`image-${active}`}>
            <span className="atlas-back-design" aria-hidden="true">
              <span className="atlas-shape atlas-shape-one" />
              <span className="atlas-shape atlas-shape-two" />
              <span className="atlas-shape atlas-shape-three" />
              <span className="atlas-shape atlas-shape-four" />
              <span className="atlas-shape atlas-shape-five" />
              <span className="atlas-shape atlas-shape-six" />
            </span>
            <Image
              src={slide.image}
              alt={slide.alt}
              fill
              priority
              sizes="(max-width: 760px) 100vw, 46vw"
            />
          </div>
          <button
            type="button"
            className="atlas-hero-arrow atlas-hero-prev"
            onClick={() => setActive((active - 1 + slides.length) % slides.length)}
            aria-label="Previous slide"
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="atlas-hero-arrow atlas-hero-next"
            onClick={() => setActive((active + 1) % slides.length)}
            aria-label="Next slide"
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
          <div
            className="atlas-slide-dots"
            role="tablist"
            aria-label="Choose featured slide"
          >
            {slides.map((item, index) => (
              <button
                key={item.variant}
                type="button"
                className={index === active ? "active" : ""}
                onClick={() => setActive(index)}
                aria-label={`Show slide ${index + 1}`}
                aria-selected={index === active}
                role="tab"
              />
            ))}
          </div>
        </section>

        <section
          className="atlas-recommendation"
          aria-labelledby="recommendation-title"
        >
          <div className="atlas-recommendation-intro">
            <p className="atlas-section-kicker">Recommended for you</p>
            <h2 id="recommendation-title">A practical place to begin</h2>
            <p>
              Not sure where to start? Follow our introductory learning pathway.
            </p>
            <Link href="#courses">View pathway</Link>
          </div>
          <div className="atlas-recommendation-list">
            {managedRecommendations.map(({ id, title, category, image }) => (
              <article className="atlas-mini-course" key={id}>
                <div className="atlas-mini-thumb">
                  <CourseCoverImage courseId={id} coverImageUrl={image} sizes="110px" />
                </div>
                <div>
                  <span>{category}</span>
                  <h3>{title}</h3>
                </div>
              </article>
            ))}
            {homeContentReady && !homeContentError && managedRecommendations.length === 0 && <p className="atlas-empty-courses">New courses are coming soon.</p>}
          </div>
        </section>

        <section
          className="atlas-section atlas-why"
          aria-labelledby="why-title"
        >
          <h2 id="why-title">Why Atlas?</h2>
          <div className="atlas-benefit-grid">
            {benefits.map(([Icon, title, copy]) => (
              <article key={title}>
                <BenefitIcon Icon={Icon} />
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          className="atlas-section atlas-course-section"
          id="courses"
          aria-labelledby="courses-title"
        >
          <div className="atlas-section-heading">
            <div>
              <p className="atlas-section-kicker">Build your confidence</p>
              <h2 id="courses-title">Discover top courses</h2>
            </div>
            <Link href="/explore">
              Browse all courses <ArrowRight size={14} />
            </Link>
          </div>
          <div
            className="atlas-category-tabs"
            role="tablist"
            aria-label="Filter courses by category"
          >
            {homeCategories.map((category) => (
              <button
                key={category}
                type="button"
                role="tab"
                aria-selected={activeCategory === category}
                className={activeCategory === category ? "active" : ""}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="atlas-course-marquee">
            <div className="atlas-course-track">
              {categoryCourses.map((course, index) => (
                <article className="atlas-course-card" key={course.id}>
                  <div className="atlas-course-image">
                    <CourseCoverImage courseId={course.id} coverImageUrl={course.image} sizes="(max-width: 760px) 100vw, 300px" />
                    <span
                      className={
                        course.status === "available"
                          ? "atlas-badge-available"
                          : "atlas-badge-soon"
                      }
                    >
                      {course.status === "available"
                        ? "Available now"
                        : "Coming soon"}
                    </span>
                    <button type="button" aria-label={`Save ${course.title}`}>
                      <Heart size={15} />
                    </button>
                  </div>
                  <div className="atlas-course-body">
                    <p>{course.category}</p>
                    <h3>{course.title}</h3>
                    <div className="atlas-course-rating">
                      <Stars />
                      <strong>4.{index === 0 ? "9" : "8"}</strong>
                    </div>
                    <div className="atlas-course-meta">
                      <span>
                        <Clock3 size={13} /> {course.duration}
                      </span>
                    </div>
                    <Link
                      href={
                        course.status === "available" ? "/login" : "#roadmap"
                      }
                    >
                      {course.status === "available"
                        ? "Start course"
                        : "View roadmap"}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
            {homeContentReady && !homeContentError && categoryCourses.length === 0 && <p className="atlas-empty-courses">New courses are coming soon.</p>}
          </div>
        </section>

        <section
          className="atlas-section atlas-new-skills"
          aria-labelledby="skills-title"
        >
          <div className="atlas-section-heading">
            <div>
              <p className="atlas-section-kicker">Continue developing</p>
              <h2 id="skills-title">Unlock something new</h2>
            </div>
            <Link href="/courses">
              Explore the library <ArrowRight size={14} />
            </Link>
          </div>
          <div className="atlas-skill-grid">
            {managedSkills.map(({ id, title, category, image, duration }, index) => (
              <article className="atlas-skill-card" key={id}>
                <div>
                  <CourseCoverImage courseId={id} coverImageUrl={image} sizes="(max-width: 760px) 100vw, 300px" />
                  <span>{index + 1}</span>
                </div>
                <p>{category}</p>
                <h3>{title}</h3>
                <div>
                  <Stars />
                  <strong>4.8</strong>
                </div>
                <p className="atlas-skill-meta">
                  <Clock3 size={13} /> {duration}
                </p>
                <Link href="/login">Join course</Link>
              </article>
            ))}
            {homeContentReady && !homeContentError && managedSkills.length === 0 && <p className="atlas-empty-courses">New courses are coming soon.</p>}
          </div>
        </section>

        <section
          className="atlas-dual-callout"
          aria-label="Explore Atlas learning"
        >
          <div>
            <p>New course</p>
            <h2>
              Looking for your next course?
              <br />
              Find out what is coming.
            </h2>
            <Link href="/courses">Browse courses</Link>
          </div>
          <div>
            <p>School learning</p>
            <h2>
              Bring practical digital learning
              <br />
              to your whole school team.
            </h2>
            <Link href="/contact">Contact Atlas</Link>
          </div>
        </section>

        <section
          className="atlas-section atlas-roadmap"
          id="roadmap"
          aria-labelledby="roadmap-title"
        >
          <div>
            <p className="atlas-section-kicker">Keep moving forward</p>
            <h2 id="roadmap-title">Discover your digital learning roadmap</h2>
            <p>
              Start with AI foundations, then keep developing through practical
              pathways created for education professionals.
            </p>
          </div>
          <div className="atlas-roadmap-chips">
              {roadmap.map((item, index) => (
                <span className={index === 0 ? "active" : ""} key={item}>
                  {item}
                  <b>+</b>
                </span>
              ))}
            </div>
          </section>

        <section
          className="atlas-section atlas-reviews"
          id="reviews"
          aria-labelledby="reviews-title"
        >
          <p className="atlas-section-kicker">Learner feedback</p>
          <h2 id="reviews-title">Explore member reviews</h2>
          <div className="atlas-review-grid">
              {reviews.map(([quote, name, role]) => (
                <blockquote key={name}>
                  <p>{quote}</p>
                  <footer>
                    <div>
                      <strong>{name}</strong>
                      <span>{role}</span>
                    </div>
                    <Stars />
                  </footer>
                </blockquote>
              ))}
            </div>
            <button type="button">View more</button>
          </section>

        <section className="atlas-join-banner">
          <div>
            <p className="atlas-section-kicker">Learning for every role</p>
            <h2>
              Help your school build
              <br />
              <span>digital confidence</span>
            </h2>
            <Link className="atlas-blue-button" href="/login">
              Register now
            </Link>
          </div>
          <div className="atlas-join-art">
            <span className="atlas-back-design" aria-hidden="true">
              <span className="atlas-shape atlas-shape-one" />
              <span className="atlas-shape atlas-shape-two" />
              <span className="atlas-shape atlas-shape-three" />
              <span className="atlas-shape atlas-shape-four" />
              <span className="atlas-shape atlas-shape-five" />
              <span className="atlas-shape atlas-shape-six" />
            </span>
            <Image
              src="/bottom.avif"
              alt="A learner celebrating her progress"
              fill
              sizes="(max-width: 760px) 100vw, 49vw"
            />
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
