import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../views/Home.vue'

const routes = [
  {
    path: '/',
    name: 'Root',
    component: () => import('../components/layouts/Layout.vue'),
    children: [
      {
        path: '/',
        name: 'Home',
        component: Home
      },
      {
        path: '/books',
        name: 'Books',
        component: () => import(/* webpackChunkName: "book" */ '../views/Book.vue')
      },
      {
        path: '/books/:version/:name',
        name: 'Lesson',
        component: () => import(/* webpackChunkName: "lesson" */ '../views/Lesson.vue'),
        props: true
      },
      {
        path: '/about',
        name: 'About',
        component: () => import(/* webpackChunkName: "about" */ '../views/About.vue')
      }
    ]
  },
  {
    name: 'NotFound',
    path: '/:pathMatch(.*)*',
    component: () => import(/* webpackChunkName: "not-found" */ '../views/exception/NotFound.vue')
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
