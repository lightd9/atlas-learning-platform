"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Eye,
  GripVertical,
  Loader2,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import AdminShell from "@/components/AdminShell";
import { DEFAULT_COURSE_COVER } from "@/lib/course-cover";
import { useToast } from "@/components/Toast";

const sections = [
  {
    key: "RECOMMENDED",
    label: "Recommended for you",
    description: "Personalised-looking highlights on the homepage.",
    limit: 5,
  },
  {
    key: "TOP_COURSES",
    label: "Discover top courses",
    description: "The main featured course collection.",
    limit: null,
  },
  {
    key: "UNLOCK_SOMETHING_NEW",
    label: "Unlock something new",
    description: "A fresh set of courses to explore.",
    limit: 6,
  },
  {
    key: "EXPLORE",
    label: "Explore catalogue",
    description: "Courses available through Explore and navbar search.",
    limit: null,
  },
];
const legacyUnlockCourses: Placement[] = [
  { id: "legacy-unlock-microsoft", courseId: "legacy-unlock-microsoft", section: "UNLOCK_SOMETHING_NEW", sortOrder: 0, course: { id: "legacy-unlock-microsoft", title: "Microsoft 365 for School Teams", coverImageUrl: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=900&q=85" } },
  { id: "legacy-unlock-data", courseId: "legacy-unlock-data", section: "UNLOCK_SOMETHING_NEW", sortOrder: 1, course: { id: "legacy-unlock-data", title: "Protecting School Data", coverImageUrl: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=900&q=85" } },
  { id: "legacy-unlock-communication", courseId: "legacy-unlock-communication", section: "UNLOCK_SOMETHING_NEW", sortOrder: 2, course: { id: "legacy-unlock-communication", title: "Better Digital Communication", coverImageUrl: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=85" } },
];
type Placement = {
  id: string;
  courseId: string;
  section: string;
  sortOrder: number;
  course?: { id: string; title: string; coverImageUrl?: string | null };
};
type Course = {
  id: string;
  title: string;
  coverImageUrl?: string | null;
  published?: boolean;
  status?: string;
  description?: string;
};

export default function HomeContentPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [saved, setSaved] = useState<Placement[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [section, setSection] = useState("RECOMMENDED");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const info = sections.find((item) => item.key === section)!;
  const current = useMemo(
    () =>
      placements
        .filter((item) => item.section === section)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [placements, section],
  );
  const matches = courses
    .filter(
      (course) =>
        !placements.some(
          (item) => item.courseId === course.id && item.section === section,
        ) && course.title.toLowerCase().includes(query.trim().toLowerCase()),
    )
    .slice(0, 8);
  const dirty =
    JSON.stringify(
      placements.map(({ id, courseId, section, sortOrder }) => ({
        id,
        courseId,
        section,
        sortOrder,
      })),
    ) !==
    JSON.stringify(
      saved.map(({ id, courseId, section, sortOrder }) => ({
        id,
        courseId,
        section,
        sortOrder,
      })),
    );
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status !== "authenticated") return;
    if (
      !["ATLAS_ADMIN", "ATLAS_EMPLOYEE"].includes(session?.user?.role ?? "")
    ) {
      router.push("/dashboard");
      return;
    }
    Promise.all([fetch("/api/admin/home-content"), fetch("/api/admin/courses")])
      .then(async ([p, c]) => {
        const pd = await p.json();
        const cd = await c.json();
        if (!p.ok)
          throw new Error(pd.error ?? "Unable to load homepage content");
        const databasePlacements = (pd.placements ?? []).filter((item: Placement) => !(item.section === "UNLOCK_SOMETHING_NEW" && ["Introduction to Artificial Intelligence", "AI Safety & Responsible Use in Schools", "Practical AI for Education"].includes(item.course?.title ?? "")));
        const existingTitles = new Set(databasePlacements.map((item: Placement) => item.course?.title));
        const effectivePlacements = [...databasePlacements, ...legacyUnlockCourses.filter((item) => !existingTitles.has(item.course?.title))];
        setPlacements(effectivePlacements);
        setSaved(effectivePlacements);
        setCourses(
          (cd.courses ?? []).filter(
            (item: Course) => item.published && item.status === "PUBLISHED",
          ),
        );
      })
      .catch((error: Error) => toast(error.message, "error"))
      .finally(() => setLoading(false));
  }, [status, session, router, toast]);
  function add(course: Course) {
    if (info.limit !== null && current.length >= info.limit) {
      toast(
        `${info.label} can contain a maximum of ${info.limit} courses.`,
        "error",
      );
      return;
    }
    setPlacements((items) => [
      ...items,
      {
        id: `draft-${Date.now()}-${course.id}`,
        courseId: course.id,
        section,
        sortOrder: current.length,
        course,
      },
    ]);
    setQuery("");
  }
  function remove(id: string) {
    const item = placements.find((entry) => entry.id === id);
    if (
      window.confirm(
        `Remove “${item?.course?.title ?? "this course"}” from this section? The course itself will not be deleted.`,
      )
    )
      setPlacements((items) => items.filter((entry) => entry.id !== id));
  }
  function move(id: string, direction: -1 | 1) {
    const index = current.findIndex((item) => item.id === id);
    const target = index + direction;
    if (target < 0 || target >= current.length) return;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    const order = new Map(next.map((item, position) => [item.id, position]));
    setPlacements((items) =>
      items.map((item) =>
        order.has(item.id) ? { ...item, sortOrder: order.get(item.id)! } : item,
      ),
    );
  }
  function drop(targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    const from = current.findIndex((item) => item.id === draggedId);
    const to = current.findIndex((item) => item.id === targetId);
    const next = [...current];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const order = new Map(next.map((item, position) => [item.id, position]));
    setPlacements((items) =>
      items.map((item) =>
        order.has(item.id) ? { ...item, sortOrder: order.get(item.id)! } : item,
      ),
    );
    setDraggedId(null);
  }
  async function saveChanges() {
    if (!dirty) return;
    setSaving(true);
    try {
      const ids = new Set(placements.map((item) => item.id));
      for (const item of saved.filter((item) => !ids.has(item.id) && !item.id.startsWith("legacy-"))) {
        const response = await fetch(`/api/admin/home-content?id=${item.id}`, {
          method: "DELETE",
        });
        if (!response.ok)
          throw new Error("Unable to remove a homepage placement");
      }
      for (const item of placements.filter((item) => !item.id.startsWith("legacy-"))) {
        const response = await fetch("/api/admin/home-content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            courseId: item.courseId,
            section: item.section,
            sortOrder: item.sortOrder,
          }),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? "Unable to save homepage changes");
        }
      }
      setSaved(placements);
      toast("Homepage changes saved.", "success");
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "Unable to save homepage changes",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }
  function discardChanges() {
    if (!dirty) return;
    if (!dirty || window.confirm("Discard all unsaved homepage changes?")) {
      setPlacements(saved);
      toast("Unsaved homepage changes discarded.", "success");
    }
  }
  return (
    <AdminShell active="home-content">
      <div className="page-wrap home-content-page">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Public site management</p>
            <h1>Edit home page</h1>
            <p className="muted">
              Curate the courses visitors discover across the Atlas public site.
            </p>
          </div>
          <Link className="secondary-button" href="/" target="_blank">
            <Eye size={16} /> View public site
          </Link>
        </div>
        <div className="content-layout">
          <aside className="panel content-sections">
            <p className="eyebrow">Homepage sections</p>
            <div className="section-tabs">
              {sections.map((item) => (
                <button
                  key={item.key}
                  className={section === item.key ? "selected" : ""}
                  onClick={() => {
                    setSection(item.key);
                    setQuery("");
                  }}
                >
                  <span>{item.label}</span>
                  <small>
                    {
                      placements.filter((entry) => entry.section === item.key)
                        .length
                    }
                    {item.limit ? ` / ${item.limit}` : ""} courses
                  </small>
                </button>
              ))}
            </div>
          </aside>
          <div className="content-main">
            <div className="panel add-content-panel">
              <p className="eyebrow">Add a course</p>
              <h2>{info.label}</h2>
              <p className="muted">{info.description}</p>
              <div className="content-search autocomplete-search">
                <Search size={16} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search published courses"
                  aria-label="Search published courses"
                  aria-expanded={query.length > 0 && matches.length > 0}
                />
                {query && matches.length > 0 && (
                  <div className="course-search-results" role="listbox">
                    {matches.map((course) => (
                      <button
                        key={course.id}
                        type="button"
                        role="option"
                        onClick={() => add(course)}
                      >
                        <span className="result-thumb">
                          {course.coverImageUrl ? (
                            <img src={course.coverImageUrl} alt="" />
                          ) : null}
                        </span>
                        <span>
                          <strong>{course.title}</strong>
                          {course.description && (
                            <small>{course.description}</small>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {query && matches.length === 0 && (
                  <div className="course-search-empty">
                    No matching published courses.
                  </div>
                )}
              </div>
            </div>
            <div className="panel placements-panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Draft placement order</p>
                  <h3>
                    {current.length}{" "}
                    {current.length === 1 ? "course" : "courses"} in this
                    section
                  </h3>
                </div>
                {saving && (
                  <span className="saving-label">
                    <Loader2 className="spin" size={14} /> Saving
                  </span>
                )}
              </div>
              {loading ? (
                <div className="placement-skeletons">
                  <div className="placement-skeleton" />
                  <div className="placement-skeleton" />
                </div>
              ) : current.length === 0 ? (
                <div className="content-empty">
                  <div>
                    <Search size={20} />
                  </div>
                  <h3>This section is empty</h3>
                  <p>Search above and click a course to add it here.</p>
                </div>
              ) : (
                <div className="placement-list">
                  {current.map((item, index) => (
                    <article
                      className={`placement-card ${draggedId === item.id ? "dragging" : ""}`}
                      key={item.id}
                      draggable
                      onDragStart={() => setDraggedId(item.id)}
                      onDragEnd={() => setDraggedId(null)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => drop(item.id)}
                    >
                      <button
                        className="drag-handle"
                        title="Reorder"
                        aria-label={`Reorder ${item.course?.title}`}
                      >
                        <GripVertical size={18} />
                      </button>
                      <div className="placement-image">
                        <img
                          src={
                            item.course?.coverImageUrl ||
                            (item.course?.id
                              ? `/api/public/course-thumbnail/${item.course.id}`
                              : DEFAULT_COURSE_COVER)
                          }
                          alt=""
                        />
                      </div>
                      <div className="placement-details">
                        <div className="placement-title-row">
                          <strong>{item.course?.title}</strong>
                          <span className="published-badge">Published</span>
                        </div>
                        <p>Visible in {info.label}</p>
                        <small>Position {index + 1}</small>
                      </div>
                      <div className="placement-actions">
                        <Link
                          className="icon-button"
                          href={`/courses/${item.course?.id}`}
                          target="_blank"
                          aria-label={`Preview ${item.course?.title}`}
                        >
                          <Eye size={16} />
                        </Link>
                        <Link
                          className="icon-button"
                          href={`/admin/courses/${item.course?.id}`}
                          aria-label={`Edit ${item.course?.title}`}
                        >
                          <Pencil size={16} />
                        </Link>
                        <button
                          className="icon-button"
                          disabled={index === 0}
                          onClick={() => move(item.id, -1)}
                          aria-label={`Move ${item.course?.title} up`}
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          className="icon-button"
                          disabled={index === current.length - 1}
                          onClick={() => move(item.id, 1)}
                          aria-label={`Move ${item.course?.title} down`}
                        >
                          <ArrowDown size={16} />
                        </button>
                        <button
                          className="icon-button danger"
                          onClick={() => remove(item.id)}
                          aria-label={`Remove ${item.course?.title}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="content-draft-actions">
          <button
            className="secondary-button"
            onClick={discardChanges}
            disabled={!dirty || saving}
          >
            Discard
          </button>
          <button
            className="primary-button"
            onClick={saveChanges}
            disabled={!dirty || saving}
          >
            {saving ? <Loader2 className="spin" size={15} /> : null}
            {saving ? ' Saving' : 'Save'}
          </button>
        </div>
        <p className="content-footnote">
          <CheckCircle2 size={15} /> Changes affect the public homepage and
          Explore catalogue after the next content refresh. Removing a course
          here never deletes it.
        </p>
      </div>
    </AdminShell>
  );
}
