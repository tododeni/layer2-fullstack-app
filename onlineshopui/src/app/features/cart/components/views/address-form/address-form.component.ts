import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { AddressFormGroup } from '../../../types/address-form.types';
import { ErrorMessageComponent } from '../../../../../clib/components/error-message/error-message.component';
import { CardComponent } from '../../../../../clib/components/card/card.component';

@Component({
    selector: 'app-address-form',
    imports: [ReactiveFormsModule, ErrorMessageComponent, CardComponent],
    templateUrl: './address-form.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddressFormComponent {
    form = input.required<AddressFormGroup>();
    isDisabled = input<boolean>(false);
}
