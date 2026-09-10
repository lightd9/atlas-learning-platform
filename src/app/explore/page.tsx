import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BookOpen, Clock3, Heart, Star } from "lucide-react";
import PublicFooter from "@/components/PublicFooter";
import PublicNavbar from "@/components/PublicNavbar";
import { categoryId, publicCourseCategories, publicCourses } from "@/data/publicCourses";

function CourseStars() {
  return (
    <span className="atlas-stars" aria-label="4.8 out of 5 stars">
      {[1, 2, 3, 4, 5].map((star) => <Star key={star} size={12} fill="currentColor" />)}
    </span>
  );
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const query = q.toLowerCase().trim();
  const filtered = query
    ? publicCourses.filter((course) =>
        (course.title + " " + course.category).toLowerCase().includes(query),
      )
    : publicCourses;

  return (
    <div className="atlas-public-home atlas-explore-page">
      <PublicNavbar />
      <main>
        <section className="atlas-explore-intro" aria-labelledby="explore-title">
          <p className="atlas-section-kicker">
            {query ? `Search results for "${query}"` : "Atlas course library"}
          </p>
          <h1 id="explore-title">
            {query ? "Courses matching your search" : "Explore learning built for schools"}
          </h1>
          <p>
            {query
              ? `${filtered.length} ${filtered.length === 1 ? "course" : "courses"} match your search.`
              : "Browse practical courses by topic and find the next step for your professional development."}
          </p>
          <nav aria-label="Course categories">
            {publicCourseCategories.map((category) => (
              <Link key={category} href={`#${categoryId(category)}`}>{category}</Link>
            ))}
          </nav>
        </section>

        {filtered.length === 0 ? (
          <div className="atlas-explore-catalogue">
            <section className="atlas-explore-category" aria-labelledby="no-results-title">
              <div className="atlas-section-heading">
                <div>
                  <p className="atlas-section-kicker">No results</p>
                  <h2 id="no-results-title">Nothing matched your search</h2>
                </div>
                <Link href="/explore">Clear search <ArrowRight size={14} /></Link>
              </div>
            </section>
          </div>
        ) : (
          <div className="atlas-explore-catalogue">
          {publicCourseCategories.map((category) => {
            const courses = filtered.filter((course) => course.category === category);
            if (courses.length === 0 && query) return null;
            return (
              <section id={categoryId(category)} className="atlas-explore-category" key={category} aria-labelledby={`${categoryId(category)}-title`}>
                <div className="atlas-section-heading">
                  <div>
                    <p className="atlas-section-kicker">{courses.length} {courses.length === 1 ? "course" : "courses"}</p>
                    <h2 id={`${categoryId(category)}-title`}>{category}</h2>
                  </div>
                  <Link href="/login">Start learning <ArrowRight size={14} /></Link>
                </div>
                <div className="atlas-explore-course-grid">
                  {courses.map((course, index) => (
                    <article className="atlas-course-card" key={course.title}>
                      <div className="atlas-course-image">
                        <Image src={course.image} alt="" fill sizes="(max-width: 760px) 100vw, 300px" />
                        <span className={course.status === "available" ? "atlas-badge-available" : "atlas-badge-soon"}>
                          {course.status === "available" ? "Available now" : "Coming soon"}
                        </span>
                        <button type="button" aria-label={`Save ${course.title}`}><Heart size={15} /></button>
                      </div>
                      <div className="atlas-course-body">
                        <p>{course.category}</p>
                        <h3>{course.title}</h3>
                        <div className="atlas-course-rating"><CourseStars /><strong>4.{index === 0 ? "9" : "8"}</strong></div>
                        <div className="atlas-course-meta">
                          <span><BookOpen size={13} /> {course.lessons} lessons</span>
                          <span><Clock3 size={13} /> {course.duration}</span>
                        </div>
                        <Link href={course.status === "available" ? "/login" : "/#roadmap"}>
                          {course.status === "available" ? "Start course" : "View roadmap"}
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
          </div>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}
