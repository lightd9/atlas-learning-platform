export type PublicCourse = {
  id: string;
  title: string;
  category: string;
  duration: string;
  lessons: number;
  image: string;
  status: "available" | "coming-soon";
};

export type PublicHomeCourse = {
  id: string;
  title: string;
  durationMinutes: number;
  coverImageUrl?: string | null;
  section?: { name: string } | null;
};

export function publicCourseFromPlacement(course: PublicHomeCourse): PublicCourse {
  return { id: course.id, title: course.title, category: course.section?.name ?? 'Course', duration: `${course.durationMinutes ?? 0} min`, lessons: 0, status: 'available', image: course.coverImageUrl?.trim() || `/api/public/course-thumbnail/${course.id}` };
}

export function categoryId(category: string) {
  return category.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
