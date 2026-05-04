import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { AllowedEmailsService } from '../../../core/services/allowed-emails.service';
import { AllowedEmail } from '../../../core/models/admin.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {
  private authService = inject(AuthService);
  private allowedEmailsService = inject(AllowedEmailsService);
  private fb = inject(FormBuilder);

  emails = signal<AllowedEmail[]>([]);
  isLoading = signal<boolean>(false);
  isAdding = signal<boolean>(false);
  error = signal<string>('');
  addError = signal<string>('');
  deletingId = signal<number | null>(null);
  confirmDeleteId = signal<number | null>(null);

  addForm: FormGroup = this.fb.group({
    email: ['', [
      Validators.required,
      Validators.email,
      Validators.pattern('^[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}$')
    ]]
  });

  currentAdminEmail = computed(() => this.authService.currentAdmin()?.email ?? '');

  firstEmailId = computed(() => {
    const list = this.emails();
    if (!list.length) return null;
    return list.reduce((minId, e) => (e.id < minId ? e.id : minId), list[0].id);
  });

  emailBeingDeleted = computed(() => {
    const id = this.confirmDeleteId();
    return this.emails().find(e => e.id === id) ?? null;
  });

  get f() { return this.addForm.controls; }

  ngOnInit(): void {
    this.loadEmails();
  }

  loadEmails(): void {
    this.isLoading.set(true);
    this.error.set('');

    this.allowedEmailsService.getAll().subscribe({
      next: (response) => {
        this.emails.set(response.data);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la lista de correos.');
        this.isLoading.set(false);
      }
    });
  }

  onAddEmail(): void {
    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      return;
    }

    this.isAdding.set(true);
    this.addError.set('');

    this.allowedEmailsService.add(this.addForm.value.email.trim()).subscribe({
      next: (response) => {
        this.emails.update(list => [...list, response.data]);
        this.addForm.reset();
        this.isAdding.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.addError.set(err.error?.message ?? 'Error al añadir el correo.');
        this.isAdding.set(false);
      }
    });
  }

  canDelete(email: AllowedEmail): boolean {
    return (
      email.email !== this.currentAdminEmail() &&
      email.id !== this.firstEmailId()
    );
  }

  getDeleteTooltip(email: AllowedEmail): string {
    if (email.id === this.firstEmailId()) return 'No puedes eliminar el correo fundador';
    if (email.email === this.currentAdminEmail()) return 'No puedes eliminar tu propio correo';
    return 'Eliminar correo';
  }

  requestDelete(id: number): void {
    this.confirmDeleteId.set(id);
  }

  cancelDelete(): void {
    this.confirmDeleteId.set(null);
  }

  confirmDelete(): void {
    const id = this.confirmDeleteId();
    if (id === null) return;

    this.deletingId.set(id);
    this.confirmDeleteId.set(null);

    this.allowedEmailsService.delete(id).subscribe({
      next: () => {
        this.emails.update(list => list.filter(e => e.id !== id));
        this.deletingId.set(null);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.message ?? 'Error al eliminar el correo.');
        this.deletingId.set(null);
      }
    });
  }
}
