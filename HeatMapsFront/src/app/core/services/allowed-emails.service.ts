import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AllowedEmail } from '../models/admin.model';
import { API_URL } from '../constants/api.constants';

export interface AllowedEmailsListResponse {
  success: boolean;
  data: AllowedEmail[];
}

export interface AllowedEmailItemResponse {
  success: boolean;
  data: AllowedEmail;
}

export interface DeleteEmailResponse {
  success: boolean;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class AllowedEmailsService {
  private http = inject(HttpClient);

  getAll(): Observable<AllowedEmailsListResponse> {
    return this.http.get<AllowedEmailsListResponse>(`${API_URL}/allowed-emails`);
  }

  add(email: string): Observable<AllowedEmailItemResponse> {
    return this.http.post<AllowedEmailItemResponse>(`${API_URL}/allowed-emails`, { email });
  }

  delete(id: number): Observable<DeleteEmailResponse> {
    return this.http.delete<DeleteEmailResponse>(`${API_URL}/allowed-emails/${id}`);
  }
}
