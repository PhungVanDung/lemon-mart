import { Component, OnDestroy, OnInit } from '@angular/core'
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms'
import { BehaviorSubject, Observable, merge, of } from 'rxjs'
import { map, startWith } from 'rxjs/operators'
import { BaseFormComponent } from 'src/app/common/base-form.class'
import { UiService } from 'src/app/common/ui.service'
import { SubSink } from 'subsink'
import { $enum } from 'ts-enum-util'

import { AuthService } from '../../auth/auth.service'
import { Role as UserRole } from '../../auth/role.enum'
import {
  BirthDateValidation,
  EmailValidation,
  OneCharValidation,
  OptionalTextValidation,
  RequiredTextValidation,
  USAPhoneNumberValidation,
  USAZipCodeValidation,
} from '../../common/validations'
import { IName, IPhone, IUser } from '../user/user'
import { UserService } from '../user/user.service'
import { IUSState, PhoneType, USStateFilter } from './data'

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
})
export class ProfileComponent extends BaseFormComponent<IUser>
  implements OnInit, OnDestroy {
  Role = UserRole
  PhoneTypes = $enum(PhoneType).getKeys()

  states$: Observable<IUSState[]>
  userError = ''
  readonly nameInitialData$ = new BehaviorSubject<IName>({
    first: '',
    middle: '',
    last: '',
  })

  private subs = new SubSink()
  private get currentUserRole() {
    return this.authService.authStatus$.value.userRole
  }

  // conditional for demo purposes only
  useAppNameInputComponent = true

  constructor(
    private formBuilder: FormBuilder,
    private userService: UserService,
    private authService: AuthService,
    private uiService: UiService
  ) {
    super()
  }

  ngOnInit() {
    this.formGroup = this.buildForm()

    // loadFromCacheForDemo is for ad-hoc cache loading, demo purposes only
    this.subs.add(
      merge(this.loadFromCacheForDemo(), this.userService.getCurrentUser()).subscribe(
        user => {
          if (user) {
            this.patchUpdatedData(user)
            this.nameInitialData$.next(user.name)
          }
        }
      )
    )
  }

  ngOnDestroy() {
    this.subs.unsubscribe()
    this.deregisterAllForms()
  }

  buildForm(initialData?: IUser): FormGroup {
    const user = initialData

    const form = this.formBuilder.group({
      email: [
        {
          value: (user && user.email) || '',
          disabled: this.currentUserRole !== this.Role.Manager,
        },
        EmailValidation,
      ],
      name: this.useAppNameInputComponent
        ? null
        : this.formBuilder.group({
            // this will get overwritten if useAppNameInputComponent is set to true
            first: [user && user.name ? user.name.first : '', RequiredTextValidation],
            middle: [user && user.name ? user.name.middle : '', OneCharValidation],
            last: [user && user.name ? user.name.last : '', RequiredTextValidation],
          }),
      role: [
        {
          value: (user && user.role) || '',
          disabled: this.currentUserRole !== this.Role.Manager,
        },
        [Validators.required],
      ],
      level: [null, [Validators.required]],
      // use the code below to test disabled condition of <app-lemon-rater>
      // level: [{ value: 2, disabled: true }, [Validators.required]],
      dateOfBirth: [(user && user.dateOfBirth) || '', BirthDateValidation],
      address: this.formBuilder.group({
        line1: [
          (user && user.address && user.address.line1) || '',
          RequiredTextValidation,
        ],
        line2: [
          (user && user.address && user.address.line2) || '',
          OptionalTextValidation,
        ],
        city: [(user && user.address && user.address.city) || '', RequiredTextValidation],
        state: [
          (user && user.address && user.address.state) || '',
          RequiredTextValidation,
        ],
        zip: [(user && user.address && user.address.zip) || '', USAZipCodeValidation],
      }),
      phones: this.formBuilder.array(this.buildPhoneArray(user ? user.phones : [])),
    })

    this.states$ = form
      .get('address')
      .get('state')
      .valueChanges.pipe(
        startWith(''),
        map(value => USStateFilter(value))
      )

    this.cacheChangesForDemo(form)

    return form
  }

  addPhone() {
    this.phonesArray.push(this.buildPhoneFormControl(this.phonesArray.value.length + 1))
  }

  get phonesArray(): FormArray {
    return this.formGroup.get('phones') as FormArray
  }

  get name(): FormGroup {
    return this.formGroup.get('name') as FormGroup
  }

  private buildPhoneArray(phones: IPhone[]) {
    const groups = []

    if (!phones || (phones && phones.length === 0)) {
      groups.push(this.buildPhoneFormControl(1))
    } else {
      phones.forEach(p => {
        groups.push(this.buildPhoneFormControl(p.id, p.type, p.digits))
      })
    }
    return groups
  }

  private buildPhoneFormControl(id, type?: string, phoneNumber?: string) {
    return this.formBuilder.group({
      id: [id],
      type: [type || '', Validators.required],
      number: [phoneNumber || '', USAPhoneNumberValidation],
    })
  }

  get dateOfBirth() {
    return this.formGroup.get('dateOfBirth').value || new Date()
  }

  get age() {
    return new Date().getFullYear() - this.dateOfBirth.getFullYear()
  }

  async save(form: FormGroup) {
    this.subs.add(
      this.userService
        .updateUser(form.value)
        .subscribe(res => this.patchUpdatedData(res), err => (this.userError = err))
    )
  }

  simulateLazyLoadedInitData() {
    // for demo purposes only
    this.nameInitialData$.next({
      first: 'Peter',
      middle: 'A',
      last: 'Long',
    })
  }

  private cacheChangesForDemo(form: FormGroup) {
    // for demo purposes only
    this.subs.add(
      form.valueChanges.subscribe(() => {
        localStorage.setItem('draft-user', form.value)
        // console.log(form.value)
      })
    )
  }

  private loadFromCacheForDemo(): Observable<IUser> {
    // for demo purposes only
    let data = null

    try {
      data = JSON.parse(localStorage.getItem('draft-user'))
      if (data) {
        this.uiService.showToast('Loaded data from cache')
      }
    } catch (err) {
      // no-op
    }

    return of(data)
  }
}
