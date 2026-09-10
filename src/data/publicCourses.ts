export const publicCourseCategories = [
  "Artificial Intelligence",
  "Safety",
  "Productivity",
  "Cybersecurity",
  "Leadership",
] as const;

export type PublicCourseCategory = (typeof publicCourseCategories)[number];

export type PublicCourse = {
  title: string;
  category: PublicCourseCategory;
  duration: string;
  lessons: number;
  image: string;
  status: "available" | "coming-soon";
};

export const publicCourses: PublicCourse[] = [
  { title: "Introduction to Artificial Intelligence", category: "Artificial Intelligence", duration: "20 min", lessons: 5, status: "available", image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=800&q=85" },
  { title: "Practical AI for Education", category: "Artificial Intelligence", duration: "30 min", lessons: 7, status: "available", image: "https://images.unsplash.com/photo-1516321165247-4aa89a48be28?auto=format&fit=crop&w=800&q=85" },
  { title: "Generative AI for Teachers", category: "Artificial Intelligence", duration: "Coming soon", lessons: 8, status: "coming-soon", image: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=800&q=85" },
  { title: "AI Safety & Responsible Use in Schools", category: "Safety", duration: "25 min", lessons: 6, status: "available", image: "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=85" },
  { title: "Online Safety Essentials", category: "Safety", duration: "Coming soon", lessons: 7, status: "coming-soon", image: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?auto=format&fit=crop&w=800&q=85" },
  { title: "Digital Wellbeing for Staff", category: "Safety", duration: "Coming soon", lessons: 6, status: "coming-soon", image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=85" },
  { title: "Microsoft 365 for School Teams", category: "Productivity", duration: "Coming soon", lessons: 8, status: "coming-soon", image: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=800&q=85" },
  { title: "Better Digital Communication", category: "Productivity", duration: "Coming soon", lessons: 6, status: "coming-soon", image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=800&q=85" },
  { title: "Time Management with Digital Tools", category: "Productivity", duration: "Coming soon", lessons: 7, status: "coming-soon", image: "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=800&q=85" },
  { title: "Cybersecurity Awareness for Schools", category: "Cybersecurity", duration: "Coming soon", lessons: 8, status: "coming-soon", image: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=800&q=85" },
  { title: "Protecting School Data", category: "Cybersecurity", duration: "Coming soon", lessons: 6, status: "coming-soon", image: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=800&q=85" },
  { title: "Leading Digital Change", category: "Leadership", duration: "Coming soon", lessons: 7, status: "coming-soon", image: "https://images.unsplash.com/photo-1507537297725-24a1c029d3ca?auto=format&fit=crop&w=800&q=85" },
  { title: "Coaching & Team Development", category: "Leadership", duration: "Coming soon", lessons: 6, status: "coming-soon", image: "https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=800&q=85" },
];

export function categoryId(category: string) {
  return category.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
