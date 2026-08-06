import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AppUpdateService } from './services/app-update';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('Restaurante');

  private readonly appUpdateService = inject(AppUpdateService);

  ngOnInit(): void {
    this.appUpdateService.start();
  }
}