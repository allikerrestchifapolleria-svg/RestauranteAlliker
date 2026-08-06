import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../../../services/auth';

@Component({
  selector: 'app-no-branch',
  templateUrl: './no-branch.html',
  styleUrl: './no-branch.css',
})
export class NoBranchComponent {
  constructor(private auth: Auth, private router: Router) {}

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
