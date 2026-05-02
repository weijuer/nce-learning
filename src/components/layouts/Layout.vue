<template>
  <div class="holy-grail">
    <header class="app-header">
      <div class="app-header__container container">
        <a href="/" class="nav-logo">
          <span class="nav-logo-bracket">[</span>
          <span class="nav-logo-text">NCE</span>
          <span class="nav-logo-bracket">]</span>
        </a>

        <nav>
          <ul class="app-nav split-navigation">
            <li class="split-navigation__item">
              <router-link to="/">Home</router-link>
            </li>
            <li class="split-navigation__item">
              <router-link to="/books">Books</router-link>
            </li>
            <li class="split-navigation__item">
              <router-link to="/about">About</router-link>
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
        <router-view></router-view>
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
      <div class="container">
        <div class="copyright">© 2024 — present Weijuer. All rights reserved.</div>
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
    transform: translateY(-100%);
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

::view-transition-old(root) {
  animation:
    90ms cubic-bezier(0.4, 0, 1, 1) both fade-out,
    300ms cubic-bezier(0.4, 0, 0.2, 1) both slide-to-left;
}

::view-transition-new(root) {
  animation:
    210ms cubic-bezier(0, 0, 0.2, 1) 90ms both fade-in,
    300ms cubic-bezier(0.4, 0, 0.2, 1) both slide-from-right;
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
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

.app-header {
  --z-nav: 200;

  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: var(--z-nav);
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
    height: 3.5rem;
  }
}

.app-main {
  flex: auto;
  min-height: 0;
}

.app-footer {
  --w-footer-height: 24px;

  padding: 14px 2px;
  min-height: var(--w-footer-height);
  color: var(--color-text);
  font-size: 14px;
  background: light-dark(#ffffffd9, #000000d9);
}

.split-navigation {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  list-style: none;

  .split-navigation__item {
    a {
      font-family: var(--font-mono);
      font-size: 0.8rem;
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

.page-hero {
  margin-bottom: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;

  h1 {
    font-size: 2.5rem;
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
