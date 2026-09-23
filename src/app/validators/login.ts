import { Validators } from '@angular/forms';

export const loginValidators = {
  email: [
    Validators.required,
    Validators.email,
    Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/),
  ],
  password: [
    Validators.required,
    Validators.minLength(6),
  ],
};
