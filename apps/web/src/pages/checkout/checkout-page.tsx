import { useState, useRef, useEffect } from 'react';

import { useQuery, useMutation } from '@tanstack/react-query';
import {
  CreditCard,
  Lock,
  ArrowLeft,
  Calendar,
  User,
  Info,
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { paymentApi } from '@/lib/api/payment-api';

interface Course {
  id: string;
  title: string;
  price: string;
  thumbnailUrl: string;
  description: string;
}

export default function CheckoutPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  // Form State
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [isProcessing, setIsProcessing] = useState(false);

  const { data: course, isLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: async () => {
      const res = await api.get<Course>(`/courses/${courseId}`);
      return res.data;
    },
    enabled: Boolean(courseId),
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    const cleanCard = cardNumber.replace(/\D/g, '');

    if (cleanCard.length !== 16) {
      newErrors.cardNumber = 'Card number must be 16 digits';
    }

    if (!/^(0[1-9]|1[0-2])\/([0-9]{2})$/.test(expiry)) {
      newErrors.expiry = 'Must be MM/YY';
    } else {
      // Simple expiry check (future date)
      const [month, year] = expiry.split('/').map(Number);
      const currentYear = new Date().getFullYear() % 100;
      const currentMonth = new Date().getMonth() + 1;

      if (
        year < currentYear ||
        (year === currentYear && month < currentMonth)
      ) {
        newErrors.expiry = 'Card has expired';
      }
    }

    if (!/^\d{3,4}$/.test(cvc)) {
      newErrors.cvc = 'invalid CVC';
    }

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const processPaymentMutation = useMutation({
    mutationFn: async () => {
      // 1. Create checkout session
      const payment = await paymentApi.createCheckoutSession({
        courseId: courseId!,
      });

      // 2. Process payment
      const cleanCardNumber = cardNumber.replace(/\s/g, '');

      return paymentApi.processPayment({
        paymentId: payment.id,
        cardDetails: {
          cardNumber: cleanCardNumber,
          expiryDate: expiry,
          cvc,
          cardHolderName: name,
        },
      });
    },
    onSuccess: () => {
      toast.success('Payment successful! You are now enrolled.');
      void navigate(`/courses/${courseId}/learn`);
    },
    onError: (error: unknown) => {
      const errorMessage =
        error instanceof Error && 'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : 'Payment failed. Please try again.';
      toast.error(errorMessage ?? 'Payment failed. Please try again.');
    },
  });

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) {
      return;
    }

    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    setIsProcessing(true);
    try {
      await processPaymentMutation.mutateAsync();
      setIsProcessing(false);
    } catch {
      setIsProcessing(false);
    }
  };

  const cardNumberInputRef = useRef<HTMLInputElement>(null);
  const [cursorPosition, setCursorPosition] = useState<number | null>(null);

  // Effect to restore cursor position after render
  useEffect(() => {
    if (cardNumberInputRef.current && cursorPosition !== null) {
      cardNumberInputRef.current.setSelectionRange(
        cursorPosition,
        cursorPosition,
      );
      setCursorPosition(null); // Reset
    }
  }, [cardNumber, cursorPosition]);

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const oldCursor = input.selectionStart ?? 0;
    const rawValue = input.value;
    const cleanValue = rawValue.replace(/\D/g, '').slice(0, 16);

    // Format: groups of 4
    const parts = cleanValue.match(/.{1,4}/g);
    const formattedValue = parts ? parts.join(' ') : cleanValue;

    // Calculate new cursor position logic
    // Simple heuristic: count non-digit chars before cursor in old vs new?
    // Better: count digits before cursor.
    // 1. Get digits before old cursor in *raw input value*
    // But the input value has already changed by the user typing.

    // Let's rely on Counting Digits:
    // Position of cursor relative to DIGITS should stay same.
    // Count how many digits are to the left of the cursor in the *current input value*
    let digitsBeforeCursor = 0;
    for (const char of rawValue.slice(0, oldCursor)) {
      if (/\d/.test(char)) {
        digitsBeforeCursor++;
      }
    }

    // Find where that many digits is in the new formatted string
    let newCursor = 0;
    let digitsSeen = 0;
    for (const char of formattedValue) {
      if (digitsSeen >= digitsBeforeCursor) {
        break;
      }
      if (/\d/.test(char)) {
        digitsSeen++;
      }
      newCursor++;
    }

    // Edge case: if we just typed a digit and it added a space right before it,
    // the cursor might need adjustment? The loop handles it mostly.
    // Exception: Backspacing a space -> we want to delete the digit before it.
    // User behavior: "delete 1 number in before / position"
    // "2132 18" -> Del space -> "213218" -> "2132 18". Cursor at formatted length.
    // Standard behavior is: backspacing a space deletes the char before it.

    // Check if user Backspaced a space:
    // Current raw value has ONE less non-digit char?
    // Actually, preventing the cursor jump is the main request.

    setCursorPosition(newCursor);
    setCardNumber(formattedValue);

    if (errors.cardNumber) {
      setErrors((prev) => ({ ...prev, cardNumber: '' }));
    }
  };

  const expiryInputRef = useRef<HTMLInputElement>(null);
  const [expiryCursorPosition, setExpiryCursorPosition] = useState<
    number | null
  >(null);

  useEffect(() => {
    if (expiryInputRef.current && expiryCursorPosition !== null) {
      expiryInputRef.current.setSelectionRange(
        expiryCursorPosition,
        expiryCursorPosition,
      );
      setExpiryCursorPosition(null);
    }
  }, [expiry, expiryCursorPosition]);

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const oldCursor = input.selectionStart ?? 0;
    const rawValue = input.value;
    const digitsOnly = rawValue.replace(/\D/g, '');

    // Limit to 4 digits (MMYY)
    const cleanValue = digitsOnly.slice(0, 4);

    let formattedValue = cleanValue;
    if (cleanValue.length >= 3) {
      formattedValue = `${cleanValue.slice(0, 2)}/${cleanValue.slice(2)}`;
    }

    // Calculate new cursor position
    let digitsBeforeCursor = 0;
    for (const char of rawValue.slice(0, oldCursor)) {
      if (/\d/.test(char)) {
        digitsBeforeCursor++;
      }
    }

    let newCursor = 0;
    let digitsSeen = 0;
    for (const char of formattedValue) {
      if (digitsSeen >= digitsBeforeCursor) {
        break;
      }
      if (/\d/.test(char)) {
        digitsSeen++;
      }
      newCursor++;
    }

    setExpiry(formattedValue);
    setExpiryCursorPosition(newCursor);

    if (errors.expiry) {
      setErrors((prev) => ({ ...prev, expiry: '' }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!course) {
    return <div className="text-center p-8">Course not found</div>;
  }

  return (
    <div className="container mx-auto max-w-5xl py-12 px-4 md:px-6 animate-fade-in">
      <Button
        variant="ghost"
        onClick={() => void navigate(-1)}
        className="mb-8 hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Course
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Order Summary */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight">Order Summary</h2>
          <Card className="overflow-hidden border-border/50 shadow-md">
            <div className="relative w-full bg-muted">
              {/* Changed to w-full h-auto to show full image, max-h to prevent massive height */}
              {course.thumbnailUrl ? (
                <img
                  src={course.thumbnailUrl}
                  alt={course.title}
                  className="w-full h-auto max-h-[400px] object-contain mx-auto"
                />
              ) : (
                <div className="flex items-center justify-center w-full h-48 text-muted-foreground bg-slate-100">
                  No image available
                </div>
              )}
            </div>
            <CardContent className="p-6">
              <h3 className="text-xl font-bold mb-3">{course.title}</h3>
              <p className="text-muted-foreground text-sm line-clamp-3 mb-6 leading-relaxed">
                {course.description}
              </p>
              <div className="flex justify-between items-center py-4 border-t border-border">
                <span className="font-medium text-muted-foreground">
                  Total Price
                </span>
                <span className="text-3xl font-bold text-primary">
                  ${Number(course.price).toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Form */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight">Secure Checkout</h2>
          <Card className="border-border/50 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Credit Card Payment
              </CardTitle>
              <div className="flex items-start gap-2 mt-2 p-3 bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300 rounded-md text-xs">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Mock Payment Gateway: Enter any valid card format to succeed.
                  Use <strong className="font-mono">4000 0000 0000 0000</strong>{' '}
                  to simulate failure.
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => void handlePayment(e)}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <Label
                    htmlFor="name"
                    className={errors.name ? 'text-destructive' : ''}
                  >
                    Cardholder Name
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (errors.name) {
                          setErrors((prev) => ({ ...prev, name: '' }));
                        }
                      }}
                      className={`pl-9 ${errors.name ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                    />
                  </div>
                  {errors.name && (
                    <span className="text-xs text-destructive">
                      {errors.name}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="cardNumber"
                    className={errors.cardNumber ? 'text-destructive' : ''}
                  >
                    Card Number
                  </Label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="cardNumber"
                      placeholder="0000 0000 0000 0000"
                      value={cardNumber}
                      onChange={handleCardNumberChange}
                      maxLength={19}
                      ref={cardNumberInputRef}
                      className={`pl-9 font-mono ${errors.cardNumber ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                    />
                  </div>
                  {errors.cardNumber && (
                    <span className="text-xs text-destructive">
                      {errors.cardNumber}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label
                      htmlFor="expiry"
                      className={errors.expiry ? 'text-destructive' : ''}
                    >
                      Expiry Date
                    </Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="expiry"
                        placeholder="MM/YY"
                        value={expiry}
                        onChange={handleExpiryChange}
                        maxLength={5}
                        ref={expiryInputRef}
                        className={`pl-9 font-mono ${errors.expiry ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                      />
                    </div>
                    {errors.expiry && (
                      <span className="text-xs text-destructive">
                        {errors.expiry}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="cvc"
                      className={errors.cvc ? 'text-destructive' : ''}
                    >
                      CVC
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="cvc"
                        type="password"
                        placeholder="123"
                        value={cvc}
                        onChange={(e) => {
                          const val = e.target.value
                            .replace(/\D/g, '')
                            .slice(0, 4);
                          setCvc(val);
                          if (errors.cvc) {
                            setErrors((prev) => ({ ...prev, cvc: '' }));
                          }
                        }}
                        maxLength={4}
                        className={`pl-9 font-mono ${errors.cvc ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                      />
                    </div>
                    {errors.cvc && (
                      <span className="text-xs text-destructive">
                        {errors.cvc}
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-4">
                  <Button
                    type="submit"
                    className="w-full h-12 text-base shadow-lg shadow-primary/20 transition-colors hover:scale-[1.01]"
                    size="lg"
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <>Processing Payment...</>
                    ) : (
                      `Pay $${Number(course.price).toFixed(2)}`
                    )}
                  </Button>
                  <div className="text-center mt-4">
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5 bg-muted/50 py-2 rounded-full inline-block px-4">
                      <Lock className="h-3 w-3" />
                      Encrypted & Secure Payment
                    </p>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
