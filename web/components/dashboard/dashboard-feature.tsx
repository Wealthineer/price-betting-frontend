'use client';

import { AppHero } from '../ui/ui-layout';
import { Description, Field, FieldGroup, Fieldset, Label, Legend  } from '../tailwindui-catalyst/fieldset';
import { Input } from '../tailwindui-catalyst/input';
import { Select } from '../tailwindui-catalyst/select';
import { Textarea } from '../tailwindui-catalyst/textarea';
import { Text } from '../tailwindui-catalyst/text';
import { AccountButtons, AccountTransactions } from '../account/account-ui';

export default function DashboardFeature() {
  return (
    <div>
      <AppHero 
        title="Welcome to P2P Betting" 
        subtitle={
        <div>
          <div>
            Battle it out with your friends and earn some SOL by predicting the right prices in the future. 
          </div>
          <br/>
          <AccountButtons />
        </div>
        } 
      />
    </div>
  );
}
