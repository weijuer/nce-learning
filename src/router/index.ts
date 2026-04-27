import { createRouter, createWebHashHistory } from "vue-router";
import Home from "../views/Home.vue";

const routes = [
  {
    path: "/",
    name: "Home",
    component: Home,
  },
  {
    path: "/:version",
    name: "book",
    component: () => import('../components/layouts/Layout.vue'),
    // component: () => import(/* webpackChunkName: "book" */ "../views/Book.vue"),
  },
  {
    path: "/:version/:name",
    name: "lesson",
    component: () =>
      import(/* webpackChunkName: "lesson" */ "../views/Lesson.vue"),
    props: true,
  },
  {
    path: "/about",
    name: "About",
    component: () =>
      import(/* webpackChunkName: "about" */ "../views/About.vue"),
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
