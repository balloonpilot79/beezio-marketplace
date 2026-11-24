import type { ChangeEventHandler } from 'react';
import type { SignupAddress } from '../utils/signupAddress';

type Props = {
  address: SignupAddress;
  onChange: ChangeEventHandler<HTMLInputElement>;
};

const fieldClass = 'mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500';

export default function SignupAddressFields({ address, onChange }: Props) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-semibold text-gray-900">Address</legend>
      <label className="block text-sm font-medium text-gray-700">
        Street address *
        <input className={fieldClass} name="streetAddress" autoComplete="street-address"
          value={address.streetAddress} onChange={onChange} required />
      </label>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="block text-sm font-medium text-gray-700">
          City *
          <input className={fieldClass} name="city" autoComplete="address-level2"
            value={address.city} onChange={onChange} required />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          State *
          <input className={fieldClass} name="state" autoComplete="address-level1" placeholder="IA"
            value={address.state} onChange={onChange} required />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          ZIP code *
          <input className={fieldClass} name="zipCode" autoComplete="postal-code" inputMode="numeric"
            pattern="[0-9]{5}(-[0-9]{4})?" title="Enter a five-digit ZIP code or ZIP+4."
            value={address.zipCode} onChange={onChange} required />
        </label>
      </div>
    </fieldset>
  );
}
