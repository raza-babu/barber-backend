import Stripe from 'stripe';
import config from '../../config';
import prisma from './prisma';
import AppError from '../errors/AppError';
import httpStatus from 'http-status';
import { UserRoleEnum } from '@prisma/client';

const stripe = new Stripe(config.stripe.stripe_secret_key as string, {
  apiVersion: '2025-08-27.basil',
});

interface TransferPayload {
  bookingId: string;
  saloonOwnerId?: string;
  barberId?: string;
  amount: number; // Amount in cents (e.g., 10000 = $100)
  paymentIntentId?: string;
  reason?: string;
}

interface TransferResult {
  success: boolean;
  transferId?: string;
  message: string;
  error?: string;
}

/**
 * Transfer payment directly to saloon owner's Stripe account
 * @param payload - Contains saloonOwnerId, amount, bookingId, and other metadata
 * @returns Transfer result with status and transfer ID
 */
export const transferToSaloonOwnerAccount = async (payload: TransferPayload): Promise<TransferResult> => {
  try {
    const { bookingId, saloonOwnerId, amount, paymentIntentId, reason } = payload;

    // Validate saloon owner exists and has completed onboarding
    const saloonOwner = await prisma.user.findUnique({
      where: { id: saloonOwnerId },
      select: {
        id: true,
        fullName: true,
        email: true,
        stripeAccountId: true,
        onBoarding: true,
      },
    });

    if (!saloonOwner) {
      return {
        success: false,
        message: 'Saloon owner not found',
        error: `Saloon owner with ID ${saloonOwnerId} does not exist`,
      };
    }

    // Check if saloon owner has completed onboarding
    if (!saloonOwner.onBoarding) {
      return {
        success: false,
        message: 'Saloon owner onboarding incomplete',
        error: `Saloon owner ${saloonOwner.fullName} has not completed Stripe onboarding`,
      };
    }

    // Check if saloon owner has Stripe account ID
    if (!saloonOwner.stripeAccountId) {
      return {
        success: false,
        message: 'Saloon owner Stripe account not configured',
        error: `Saloon owner ${saloonOwner.fullName} does not have a Stripe account connected`,
      };
    }

    // Validate amount is positive
    if (amount <= 0) {
      return {
        success: false,
        message: 'Invalid transfer amount',
        error: 'Transfer amount must be greater than 0',
      };
    }

    // Create transfer to saloon owner's Stripe account
    const transfer = await stripe.transfers.create({
      amount: amount, // Amount is in cents
      currency: 'gbp',
      destination: saloonOwner.stripeAccountId, // Saloon owner's Stripe connected account
      metadata: {
        bookingId,
        saloonOwnerId: saloonOwnerId || 'N/A',
        paymentIntentId: paymentIntentId || 'N/A',
        reason: reason || 'Payment for booking services',
        transferredAt: new Date().toISOString(),
      },
      description: `Payment transfer for booking ${bookingId}`,
    });

    // Log successful transfer
    console.log(`✅ Transfer successful - Transfer ID: ${transfer.id}, Saloon Owner: ${saloonOwner.fullName}, Amount: $${amount / 100}`);

    // Return success response
    return {
      success: true,
      transferId: transfer.id,
      message: `Successfully transferred $${amount / 100} to ${saloonOwner.fullName}`,
    };
  } catch (error: any) {
    // Handle Stripe-specific errors
    const errorMessage = error?.message || 'Unknown error occurred during transfer';
    console.error(`❌ Transfer failed:`, error);

    return {
      success: false,
      message: 'Transfer to trainer account failed',
      error: errorMessage,
    };
  }
};

/**
 * Get transfer status from Stripe
 * @param transferId - The Stripe transfer ID
 * @returns Transfer object with status
 */
export const getTransferStatus = async (transferId: string) => {
  try {
    const transfer = await stripe.transfers.retrieve(transferId);
    return transfer;
  } catch (error: any) {
    console.error('Error retrieving transfer status:', error);
    throw new AppError(httpStatus.BAD_REQUEST, `Failed to retrieve transfer status: ${error.message}`);
  }
};

/**
 * Verify saloon owner can receive payments
 * @param saloonOwnerId - The saloon owner's user ID
 * @returns Object with saloon owner's payment readiness status
 */
export const verifySaloonOwnerPaymentReadiness = async (saloonOwnerId: string) => {
  try {
    const saloonOwner = await prisma.user.findUnique({
      where: { id: saloonOwnerId, role: UserRoleEnum.SALOON_OWNER },
      select: {
        id: true,
        fullName: true,
        stripeAccountId: true,
        onBoarding: true,
      },
    });

    if (!saloonOwner) {
      return {
        ready: false,
        reason: 'Saloon owner not found',
      };
    }

    if (!saloonOwner.onBoarding) {
      return {
        ready: false,
        reason: 'Saloon owner has not completed Stripe onboarding',
      };
    }

    if (!saloonOwner.stripeAccountId) {
      return {
        ready: false,
        reason: 'Saloon owner Stripe account not configured',
      };
    }

    // Verify Stripe account is in good standing
    try {
      const account = await stripe.accounts.retrieve(saloonOwner.stripeAccountId);
      
      if (!account.charges_enabled || !account.payouts_enabled) {
        return {
          ready: false,
          reason: 'Saloon owner Stripe account not fully activated for charges and payouts',
          accountStatus: {
            chargesEnabled: account.charges_enabled,
            payoutsEnabled: account.payouts_enabled,
          },
        };
      }
    } catch (error: any) {
      return {
        ready: false,
        reason: 'Could not verify Stripe account status',
        error: error.message,
      };
    }

    return {
      ready: true,
      saloonOwnerName: saloonOwner.fullName,
      stripeAccountId: saloonOwner.stripeAccountId,
    };
  } catch (error: any) {
    console.error('Error verifying saloon owner payment readiness:', error);
    return {
      ready: false,
      reason: 'Error verifying saloon owner payment readiness',
      error: error.message,
    };
  }
};

/**
 * Transfer payment directly to barber's Stripe account
 * @param payload - Contains barberId, amount, bookingId, and other metadata
 * @returns Transfer result with status and transfer ID
 */
export const transferToBarberAccount = async (payload: TransferPayload): Promise<TransferResult> => {
  try {
    const { bookingId, barberId, amount, paymentIntentId, reason } = payload;

    if (!barberId) {
      return {
        success: false,
        message: 'Barber ID is required',
        error: 'barberId must be provided in the payload',
      };
    }

    // Validate barber exists and has completed onboarding
    const barber = await prisma.user.findUnique({
      where: { id: barberId },
      select: {
        id: true,
        fullName: true,
        email: true,
        stripeAccountId: true,
        onBoarding: true,
      },
    });

    if (!barber) {
      return {
        success: false,
        message: 'Barber not found',
        error: `Barber with ID ${barberId} does not exist`,
      };
    }

    // Check if barber has completed onboarding
    if (!barber.onBoarding) {
      return {
        success: false,
        message: 'Barber onboarding incomplete',
        error: `Barber ${barber.fullName} has not completed Stripe onboarding`,
      };
    }

    // Check if barber has Stripe account ID
    if (!barber.stripeAccountId) {
      return {
        success: false,
        message: 'Barber Stripe account not configured',
        error: `Barber ${barber.fullName} does not have a Stripe account connected`,
      };
    }

    // Validate amount is positive
    if (amount <= 0) {
      return {
        success: false,
        message: 'Invalid transfer amount',
        error: 'Transfer amount must be greater than 0',
      };
    }

    // Create transfer to barber's Stripe account
    const transfer = await stripe.transfers.create({
      amount: amount, // Amount is in cents
      currency: 'gbp',
      destination: barber.stripeAccountId, // Barber's Stripe connected account
      metadata: {
        bookingId,
        barberId,
        paymentIntentId: paymentIntentId || 'N/A',
        reason: reason || 'Commission for barbering services',
        transferredAt: new Date().toISOString(),
      },
      description: `Commission transfer for booking ${bookingId}`,
    });

    // Log successful transfer
    console.log(`✅ Transfer successful - Transfer ID: ${transfer.id}, Barber: ${barber.fullName}, Amount: $${amount / 100}`);

    // Return success response
    return {
      success: true,
      transferId: transfer.id,
      message: `Successfully transferred $${amount / 100} to ${barber.fullName}`,
    };
  } catch (error: any) {
    // Handle Stripe-specific errors
    const errorMessage = error?.message || 'Unknown error occurred during transfer';
    console.error(`❌ Transfer to barber failed:`, error);

    return {
      success: false,
      message: 'Transfer to barber account failed',
      error: errorMessage,
    };
  }
};

/**
 * Verify barber can receive payments
 * @param barberId - The barber's user ID
 * @returns Object with barber's payment readiness status
 */
export const verifyBarberPaymentReadiness = async (barberId: string) => {
  try {
    const barber = await prisma.user.findUnique({
      where: { id: barberId, role: UserRoleEnum.BARBER },
      select: {
        id: true,
        fullName: true,
        stripeAccountId: true,
        onBoarding: true,
      },
    });

    if (!barber) {
      return {
        ready: false,
        reason: 'Barber not found or invalid role',
      };
    }

    if (!barber.onBoarding) {
      return {
        ready: false,
        reason: 'Barber has not completed Stripe onboarding',
      };
    }

    if (!barber.stripeAccountId) {
      return {
        ready: false,
        reason: 'Barber Stripe account not configured',
      };
    }

    // Verify Stripe account is in good standing
    try {
      const account = await stripe.accounts.retrieve(barber.stripeAccountId);
      
      if (!account.charges_enabled || !account.payouts_enabled) {
        return {
          ready: false,
          reason: 'Barber Stripe account not fully activated for charges and payouts',
          accountStatus: {
            chargesEnabled: account.charges_enabled,
            payoutsEnabled: account.payouts_enabled,
          },
        };
      }
    } catch (error: any) {
      return {
        ready: false,
        reason: 'Could not verify Stripe account status',
        error: error.message,
      };
    }

    return {
      ready: true,
      barberName: barber.fullName,
      stripeAccountId: barber.stripeAccountId,
    };
  } catch (error: any) {
    console.error('Error verifying barber payment readiness:', error);
    return {
      ready: false,
      reason: 'Error verifying barber payment readiness',
      error: error.message,
    };
  }
};

export default {
  transferToSaloonOwnerAccount,
  transferToBarberAccount,
  getTransferStatus,
  verifySaloonOwnerPaymentReadiness,
  verifyBarberPaymentReadiness,
};
