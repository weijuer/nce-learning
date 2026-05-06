<script name="About" setup lang="ts"></script>

<template>
  <div class="About">
    <header class="page-hero">
      <h1>About</h1>
      <p>Simple · Efficient · Focus</p>
    </header>

    <div class="terminal-block">
      <div class="terminal-bar">
        <span class="terminal-dots">
          <span class="terminal-dot"></span>
          <span class="terminal-dot"></span>
          <span class="terminal-dot"></span>
        </span>
        <span class="terminal-bar-title">nce-robots :: status</span>
      </div>
      <div class="terminal-body">
        <div class="terminal-line">
          <span class="t-prompt">$</span>
          <span class="t-cmd">whoami</span>
        </div>

        <div class="terminal-line t-output">Weijuer</div>

        <div class="terminal-line">
          <span class="t-prompt">$</span>
          <span class="t-cmd">cat /etc/me.md</span>
        </div>

        <div class="terminal-line t-output">Welcome to nce learning.</div>
        <div class="terminal-line t-output">Front-end, web development, glue code.</div>
        <div class="terminal-line t-output">Notes for future me and internet strangers.</div>
        <div class="terminal-line">
          <span class="t-prompt">$</span>
          <span class="t-cursor">_</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.terminal-block {
  --terminal-bg-card: light-dark(#fff, #000);
  --terminal-surface: light-dark(#fff, #000);

  margin: 0 auto;
  max-width: clamp(500px, 50vw, 900px);
  background: var(--terminal-bg-card);
  border: 1px solid var(--color-border);
  overflow: hidden;
  border-radius: 10px;

  .terminal-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.6rem 1rem;
    background: var(--terminal-surface);
    border-bottom: 1px solid var(--color-border);

    .terminal-bar-title {
      font-family: var(--font-mono);
      font-size: 0.7rem;
      color: var(--color-text-muted);
    }

    .terminal-dots {
      display: flex;
      gap: 0.4rem;

      .terminal-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: var(--color-text-muted);

        &:first-child {
          background-color: #ff5f57;
        }

        &:last-child {
          background-color: #28c840;
        }
      }
    }
  }

  .terminal-body {
    padding: 1.25rem;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    line-height: 1.8;

    .terminal-line {
      display: flex;
      gap: 0.5rem;

      .t-prompt {
        color: var(--color-green);
        flex-shrink: 0;
      }

      .t-cmd {
        color: var(--color-cyan);
      }
    }

    .t-output {
      color: var(--color-text-dim);
      padding-left: 1.25rem;
    }

    .t-cursor {
      color: var(--color-green);
      animation: cursorBlink 1s step-end infinite;
    }
  }
}

@keyframes cursorBlink {
  0%,
  to {
    opacity: 1;
  }

  50% {
    opacity: 0;
  }
}
</style>
