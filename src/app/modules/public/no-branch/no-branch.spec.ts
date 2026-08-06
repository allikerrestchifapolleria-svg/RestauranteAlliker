import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoBranchComponent } from './no-branch';
import { Auth } from '../../../services/auth';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';

describe('NoBranchComponent', () => {
  let component: NoBranchComponent;
  let fixture: ComponentFixture<NoBranchComponent>;
  let authSpy: jasmine.SpyObj<Auth>;
  let router: Router;

  beforeEach(async () => {
    authSpy = jasmine.createSpyObj('Auth', ['logout']);

    await TestBed.configureTestingModule({
      imports: [NoBranchComponent],
      providers: [
        { provide: Auth, useValue: authSpy },
        provideRouter([]),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(NoBranchComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should logout and redirect to login', () => {
    const navigateSpy = spyOn(router, 'navigate');
    component.logout();
    expect(authSpy.logout).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });
});
