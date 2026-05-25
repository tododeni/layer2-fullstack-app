import { FormControl, FormGroup, Validators } from '@angular/forms';
import { AddressFormGroup } from '../types/address-form.types';

export function createAddressForm(): AddressFormGroup {
    return new FormGroup({
        country: new FormControl<string>('', {
            nonNullable: true,
            validators: [Validators.required, Validators.minLength(2)]
        }),
        city: new FormControl<string>('', {
            nonNullable: true,
            validators: [Validators.required, Validators.minLength(2)]
        }),
        county: new FormControl<string>('', {
            nonNullable: true,
            validators: [Validators.required, Validators.minLength(2)]
        }),
        streetAddress: new FormControl<string>('', {
            nonNullable: true,
            validators: [Validators.required, Validators.minLength(5)]
        })
    });
}
