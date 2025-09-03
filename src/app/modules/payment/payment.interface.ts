import exp from 'constants';

export interface InitializeTransactionSplitResponse {
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
  status: boolean;
  message: string;
}

// Types for transaction verification response
export interface VerifyTransactionResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    domain: string;
    status: string;
    reference: string;
    amount: number;
    paid_at: string;
    created_at: string;
    channel: string;
    currency: string;
    customer: {
      id: number;
      first_name: string | null;
      last_name: string | null;
      email: string;
      phone: string | null;
    };
    authorization: {
      authorization_code: string;
      card_type: string;
      last4: string;
      exp_month: string;
      exp_year: string;
      bin: string;
      bank: string;
      channel: string;
      signature: string;
      reusable: boolean;
      country_code: string;
    };
    metadata: Record<string, any>;
  };
}
export interface InitializeTransactionSplitResponse {
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
  status: boolean;
  message: string;
}

export interface TStripeSaveWithCustomerInfoPayload {
  paymentMethodId: string;
}
