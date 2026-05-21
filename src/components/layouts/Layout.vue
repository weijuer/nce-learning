<script setup lang="ts">
import { ref, onMounted } from 'vue'
import BackToTop from '../widgets/BackToTop.vue'

const isDark = ref(false)

onMounted(() => {
  const root = document.documentElement
  isDark.value =
    root.classList.contains('dark') || window.matchMedia('(prefers-color-scheme: dark)').matches
})

const toggleTheme = (e: MouseEvent | TouchEvent) => {
  isDark.value = !isDark.value

  const root = document.documentElement
  const viewTransition = document.startViewTransition?.(() => {
    root.classList.toggle('dark', isDark.value)
    root.classList.toggle('light', !isDark.value)
  })

  viewTransition.ready.then(() => {
    const { clientX, clientY } = e instanceof MouseEvent ? e : e.touches[0]

    const radius = Math.hypot(
      Math.max(clientX, window.innerWidth - clientX),
      Math.max(clientY, window.innerHeight - clientY)
    )

    const clipPath = [
      `circle(0% at ${clientX}px ${clientY}px)`,
      `circle(${radius}px at ${clientX}px ${clientY}px)`
    ]

    document.documentElement.animate(
      {
        clipPath: isDark.value ? clipPath.reverse() : clipPath
      },
      {
        duration: 500,
        pseudoElement: isDark.value ? '::view-transition-old(root)' : '::view-transition-new(root)'
      }
    )
  })
}
</script>

<template>
  <div class="holy-grail">
    <header class="app-header">
      <div class="app-header__container container">
        <a href="#/" class="nav-logo">
          <span class="nav-logo-bracket">[</span>
          <span class="nav-logo-text">NCE</span>
          <span class="nav-logo-bracket">]</span>
        </a>

        <nav>
          <ul class="app-nav split-navigation">
            <li class="split-navigation__item">
              <router-link
                to="/books"
                :class="{ 'router-link-exact-active': $route.path.startsWith('/books') }"
              >
                Books
              </router-link>
            </li>
            <li class="split-navigation__item">
              <router-link to="/about">About</router-link>
            </li>
            <li class="split-navigation__item">
              <button @click="toggleTheme" :class="['theme-toggle', { 'is-dark': isDark }]">
                <svg class="icon" viewBox="0 0 1024 1024">
                  <path
                    d="M512 64a448 448 0 1 1 0 896 448 448 0 0 1 0-896z m0 96a352 352 0 1 0 0 704 352 352 0 0 0 0-704z m32 64v576a288 288 0 1 1 0-576z"
                  ></path>
                </svg>
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </header>
    <main class="holy-grail__main">
      <!-- Left sidebar -->
      <!-- <aside class="holy-grail__left"></aside> -->

      <!-- Main content -->
      <article class="holy-grail__middle container">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
        <back-to-top></back-to-top>
      </article>

      <!-- Right sidebar -->
      <!-- <nav class="holy-grail__right">
        <ul class="sidebar-nav">
          <li><router-link to="/todo">Todo</router-link></li>
          <li><router-link to="/pinia">Pinia</router-link></li>
          <li><router-link to="/countdown">Countdown</router-link></li>
        </ul>
      </nav> -->
    </main>
    <footer class="app-footer">
      <div class="app-footer__container container">
        <div class="copyright">© 2016 — present Weijuer. All rights reserved.</div>
      </div>
    </footer>
  </div>
</template>

<style>
.sidebar-nav {
  li:not(:last-child) {
    a {
      view-transition-name: auto;
    }
  }
}

::view-transition-old(posts-nav) {
  animation: fade 0.2s linear forwards;
  height: 100%;
}

::view-transition-new(posts-nav) {
  animation: fade 0.3s linear reverse;
  height: 100%;
}

@keyframes fade {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-10px);
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
}

@keyframes fade-out {
  to {
    opacity: 0;
  }
}

@keyframes slide-from-right {
  from {
    transform: translateX(30px);
  }
}

@keyframes slide-to-left {
  to {
    transform: translateX(-30px);
  }
}

::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
}

.dark::view-transition-old(root) {
  z-index: 1;
}
</style>

<style>
.holy-grail {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 100vh;

  .holy-grail__main {
    padding-block-start: 8rem;
    /* Take the remaining height */
    flex-grow: 1;

    /* Layout the left sidebar, main content and right sidebar */
    display: flex;
    flex-direction: row;
  }

  .holy-grail__left {
    width: 25%;
  }

  .holy-grail__middle {
    /* Take the remaining width */
    flex-grow: 1;
  }

  .holy-grail__right {
    width: 20%;
  }
}

.container {
  margin: 0 auto;
  padding: 0 clamp(1rem, 2.5vw, 1.5rem);
  width: 100%;
  max-width: 996px;
}

.app-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 200;
  background: light-dark(#ffffffd9, #000000d9);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--color-border);
  transition:
    opacity 0.6s ease,
    transform 0.6s ease;

  .app-header__container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: clamp(3.5rem, 10vw, 4rem);
  }
}

.app-main {
  flex: auto;
  min-height: 0;
}

.app-footer {
  color: var(--color-text);
  font-size: 14px;
  background: light-dark(#ffffffd9, #000000d9);

  .app-footer__container {
    padding: 14px 2px;
    height: clamp(3.5rem, 10vw, 4rem);
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.split-navigation {
  margin: 0;
  padding: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  list-style: none;

  .split-navigation__item {
    a {
      font-family: var(--font-mono);
      font-size: clamp(0.85rem, 2.5vw, 1rem);
      font-weight: 400;
      color: var(--color-text-dim);
      padding: 0.4rem 0.75rem;
      border-radius: 3px;
      transition: all 0.2s ease;
      letter-spacing: 0.02em;

      &.router-link-exact-active,
      &:hover {
        color: var(--color-cyan);
        background: #b44aff0d;
      }
    }

    &:first-child {
      margin-left: auto;
    }

    .icon {
      vertical-align: middle;
      fill: currentColor;
      overflow: hidden;
    }
  }
}

.nav-logo {
  display: flex;
  gap: 0.15rem;
  font-family: var(--font-mono);
  font-size: 1.1rem;
  font-weight: 700;
  transition: text-shadow 0.3s ease;

  &:hover {
    text-shadow: 0 0 12px var(--color-cyan-glow);
    color: #fff;
  }

  .nav-logo-bracket {
    color: var(--color-cyan);
  }

  .nav-logo-text {
    color: var(--color-text);
  }
}

.theme-toggle {
  width: clamp(30px, 2.5vw, 40px);
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s linear;
  box-shadow: var(--color-shadow);

  &.is-dark {
    .icon {
      transform: rotate(180deg);
    }
  }
}

.page-hero {
  margin-bottom: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;

  h1 {
    font-size: clamp(1.5rem, 5vw, 2.5rem);
    font-weight: 600;
  }

  p {
    color: var(--color-text-dim);
  }
}

.copyright {
  display: flex;
  justify-content: center;
}
</style>
