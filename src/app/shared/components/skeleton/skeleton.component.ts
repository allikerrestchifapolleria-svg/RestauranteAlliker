import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="skeleton-wrapper" [class]="'skeleton-' + type" [ngStyle]="{ width: width, height: height }">
      <div class="skeleton-shimmer"></div>
    </div>
  `,
  styles: [`
    .skeleton-wrapper {
      background: #1e293b;
      border-radius: 0.625rem;
      overflow: hidden;
      position: relative;
    }

    .skeleton-text {
      height: 1rem;
      width: 80%;
      border-radius: 0.375rem;
    }

    .skeleton-title {
      height: 1.5rem;
      width: 60%;
      border-radius: 0.375rem;
    }

    .skeleton-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
    }

    .skeleton-card {
      height: 120px;
      width: 100%;
      border-radius: 1rem;
    }

    .skeleton-image {
      height: 200px;
      width: 100%;
      border-radius: 1rem;
    }

    .skeleton-button {
      height: 40px;
      width: 120px;
      border-radius: 0.625rem;
    }

    .skeleton-shimmer {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(148, 163, 184, 0.08) 40%,
        rgba(148, 163, 184, 0.15) 50%,
        rgba(148, 163, 184, 0.08) 60%,
        transparent 100%
      );
      background-size: 200% 100%;
      animation: shimmer 1.5s ease-in-out infinite;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `]
})
export class SkeletonComponent {
  @Input() type: 'text' | 'title' | 'avatar' | 'card' | 'image' | 'button' = 'text';
  @Input() width: string = '';
  @Input() height: string = '';
}