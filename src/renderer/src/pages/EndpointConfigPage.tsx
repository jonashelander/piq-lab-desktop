import { useState, useEffect, useRef, useMemo } from 'react';
import { ConfigRecord } from '../types';
import ResponseSetBar from '../components/ResponseSetBar';
import { useConfirmDialog } from '../hooks/useConfirmDialog';

// ── ThreeDS2 types ────────────────────────────────────────────────────────────

interface ThreeDS2Field { value: string; included: boolean; }
interface ThreeDS2PhoneField { value: { cc: string; subscriber: string }; included: boolean; }

interface ThreeDS2Value {
  deviceChannel:       ThreeDS2Field;
  messageCategory:     ThreeDS2Field;
  threeDSCompIn:       ThreeDS2Field;
  threeDSRequestorURL: ThreeDS2Field;
  threeDSRequestor: {
    threeDSRequestorAuthenticationInd: ThreeDS2Field;
    threeDSReqAuthMethod:              ThreeDS2Field;
    threeDSReqAuthTimestamp:           ThreeDS2Field;
    threeDSReqAuthData:                ThreeDS2Field;
    threeDSRequestorChallengeInd:      ThreeDS2Field;
    threeDSReqPriorRef:                ThreeDS2Field;
    threeDSReqPriorAuthMethod:         ThreeDS2Field;
    threeDSReqPriorAuthTimestamp:      ThreeDS2Field;
    threeDSReqPriorAuthData:           ThreeDS2Field;
  };
  cardholderAccount: {
    acctId: ThreeDS2Field; chAccAgeInd: ThreeDS2Field; chAccDate: ThreeDS2Field;
    chAccChangeInd: ThreeDS2Field; chAccChange: ThreeDS2Field; chAccPwChangeInd: ThreeDS2Field;
    chAccPwChange: ThreeDS2Field; shipAddressUsageInd: ThreeDS2Field; shipAddressUsage: ThreeDS2Field;
    txnActivityDay: ThreeDS2Field; txnActivityYear: ThreeDS2Field; provisionAttemptsDay: ThreeDS2Field;
    nbPurchaseAccount: ThreeDS2Field; suspiciousAccActivity: ThreeDS2Field;
    shipNameIndicator: ThreeDS2Field; paymentAccInd: ThreeDS2Field; paymentAccAge: ThreeDS2Field;
  };
  cardholder: {
    addrMatch: ThreeDS2Field; billAddrCity: ThreeDS2Field; billAddrCountry: ThreeDS2Field;
    billAddrLine1: ThreeDS2Field; billAddrLine2: ThreeDS2Field; billAddrLine3: ThreeDS2Field;
    billAddrPostCode: ThreeDS2Field; billAddrState: ThreeDS2Field; email: ThreeDS2Field;
    homePhone: ThreeDS2PhoneField; mobilePhone: ThreeDS2PhoneField; workPhone: ThreeDS2PhoneField;
    cardholderName: ThreeDS2Field; shipAddrCity: ThreeDS2Field; shipAddrCountry: ThreeDS2Field;
    shipAddrLine1: ThreeDS2Field; shipAddrLine2: ThreeDS2Field; shipAddrLine3: ThreeDS2Field;
    shipAddrPostCode: ThreeDS2Field; shipAddrState: ThreeDS2Field;
  };
  purchase: {
    purchaseAmount: ThreeDS2Field; purchaseCurrency: ThreeDS2Field; purchaseExponent: ThreeDS2Field;
    purchaseInstalData: ThreeDS2Field; purchaseDate: ThreeDS2Field; recurringExpiry: ThreeDS2Field;
    recurringFrequency: ThreeDS2Field; transType: ThreeDS2Field;
    merchantRiskIndicator: {
      shipIndicator: ThreeDS2Field; deliveryTimeframe: ThreeDS2Field; deliveryEmailAddress: ThreeDS2Field;
      reorderItemsInd: ThreeDS2Field; preOrderPurchaseInd: ThreeDS2Field; preOrderDate: ThreeDS2Field;
      giftCardAmount: ThreeDS2Field; giftCardCurr: ThreeDS2Field; giftCardCount: ThreeDS2Field;
    };
  };
  acquirer: { acquirerBin: ThreeDS2Field; acquirerMerchantId: ThreeDS2Field; };
  merchant: { mcc: ThreeDS2Field; merchantCountryCode: ThreeDS2Field; merchantName: ThreeDS2Field; };
  browserInformation: {
    browserAcceptHeader: ThreeDS2Field; browserIP: ThreeDS2Field; browserJavaEnabled: ThreeDS2Field;
    browserJavascriptEnabled: ThreeDS2Field; browserLanguage: ThreeDS2Field;
    browserColorDepth: ThreeDS2Field; browserScreenHeight: ThreeDS2Field;
    browserScreenWidth: ThreeDS2Field; browserTZ: ThreeDS2Field; browserUserAgent: ThreeDS2Field;
    challengeWindowSize: ThreeDS2Field;
  };
}

// ── ThreeDS2 serialization helpers ────────────────────────────────────────────

type ThreeDS2Stored = Record<string, ThreeDS2Field | ThreeDS2PhoneField | Record<string, ThreeDS2Field | ThreeDS2PhoneField>>;

function serializeThreeDS2Stored(stored: ThreeDS2Stored): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, fieldOrSection] of Object.entries(stored)) {
    if (fieldOrSection !== null && typeof fieldOrSection === 'object' && 'included' in fieldOrSection && 'value' in fieldOrSection) {
      const f = fieldOrSection as ThreeDS2Field | ThreeDS2PhoneField;
      if (f.included) out[key] = f.value;
    } else if (fieldOrSection !== null && typeof fieldOrSection === 'object') {
      const sectionOut = serializeThreeDS2Stored(fieldOrSection as ThreeDS2Stored);
      if (Object.keys(sectionOut).length > 0) out[key] = sectionOut;
    }
  }
  return out;
}

function applyThreeDS2Json(current: ThreeDS2Value, raw: Record<string, unknown>): ThreeDS2Value {
  function applySection<T extends Record<string, ThreeDS2Field | ThreeDS2PhoneField | Record<string, ThreeDS2Field | ThreeDS2PhoneField>>>(
    currentSection: T,
    rawSection: Record<string, unknown>,
  ): T {
    const result = { ...currentSection };
    for (const key of Object.keys(currentSection) as (keyof T)[]) {
      const cur = currentSection[key];
      if (cur !== null && typeof cur === 'object' && 'included' in cur && 'value' in cur) {
        const f = cur as ThreeDS2Field | ThreeDS2PhoneField;
        if (key in rawSection) {
          (result[key] as ThreeDS2Field | ThreeDS2PhoneField) = { ...f, value: rawSection[key as string] as never, included: true };
        } else {
          (result[key] as ThreeDS2Field | ThreeDS2PhoneField) = { ...f, included: false };
        }
      } else if (cur !== null && typeof cur === 'object') {
        const rawSub = (key in rawSection && rawSection[key as string] !== null && typeof rawSection[key as string] === 'object')
          ? rawSection[key as string] as Record<string, unknown>
          : {};
        (result[key] as Record<string, ThreeDS2Field | ThreeDS2PhoneField>) = applySection(
          cur as Record<string, ThreeDS2Field | ThreeDS2PhoneField>,
          rawSub,
        );
      }
    }
    return result;
  }
  return applySection(current as unknown as Record<string, ThreeDS2Field | ThreeDS2PhoneField | Record<string, ThreeDS2Field | ThreeDS2PhoneField>>, raw) as unknown as ThreeDS2Value;
}

// ── ThreeDS2Editor ────────────────────────────────────────────────────────────

function ThreeDS2SectionHeader({ title }: { title: string }) {
  return <div className="threedss2-section-header"><span>{title}</span></div>;
}

function ThreeDS2FieldRow({ label, field, savedField, parentDisabled, onToggle, onValueChange }: {
  label: string; field: ThreeDS2Field; savedField?: ThreeDS2Field; parentDisabled: boolean;
  onToggle: () => void; onValueChange: (v: string) => void;
}) {
  const dirty = savedField !== undefined && (field.included !== savedField.included || field.value !== savedField.value);
  const disabled = parentDisabled || !field.included;
  return (
    <div className={`threedss2-field${!field.included ? ' threedss2-field-excluded' : ''}${dirty ? ' field-dirty' : ''}`}>
      <button className={`toggle threedss2-field-toggle${field.included ? ' toggle-on' : ''}`} onClick={onToggle} disabled={parentDisabled} role="switch" aria-checked={field.included} />
      <span className="threedss2-field-label">{label}</span>
      <input className="field-input" value={field.value} onChange={e => onValueChange(e.target.value)} disabled={disabled} />
    </div>
  );
}

function PhoneFieldRow({ label, field, savedField, parentDisabled, onToggle, onValueChange }: {
  label: string; field: ThreeDS2PhoneField; savedField?: ThreeDS2PhoneField; parentDisabled: boolean;
  onToggle: () => void; onValueChange: (v: { cc: string; subscriber: string }) => void;
}) {
  const dirty = savedField !== undefined && (
    field.included !== savedField.included ||
    field.value.cc !== savedField.value.cc ||
    field.value.subscriber !== savedField.value.subscriber
  );
  const disabled = parentDisabled || !field.included;
  return (
    <div className={`threedss2-phone${!field.included ? ' threedss2-field-excluded' : ''}${dirty ? ' field-dirty' : ''}`}>
      <button className={`toggle threedss2-field-toggle${field.included ? ' toggle-on' : ''}`} onClick={onToggle} disabled={parentDisabled} role="switch" aria-checked={field.included} />
      <span className="threedss2-field-label">{label}</span>
      <div className="threedss2-phone-inputs">
        <input className="field-input threedss2-phone-cc" value={field.value.cc} onChange={e => onValueChange({ ...field.value, cc: e.target.value })} disabled={disabled} placeholder="cc" />
        <input className="field-input" value={field.value.subscriber} onChange={e => onValueChange({ ...field.value, subscriber: e.target.value })} disabled={disabled} placeholder="subscriber" />
      </div>
    </div>
  );
}

function ThreeDS2Editor({ value: v, savedValue: sv, disabled: d, onChange }: {
  value: ThreeDS2Value; savedValue?: ThreeDS2Value; disabled: boolean; onChange: (v: ThreeDS2Value) => void;
}) {
  function setField<K extends keyof ThreeDS2Value>(key: K, patch: Partial<ThreeDS2Value[K]>) {
    onChange({ ...v, [key]: { ...v[key], ...patch } });
  }
  function setSectionField<S extends keyof ThreeDS2Value, K extends keyof ThreeDS2Value[S]>(section: S, key: K, patch: Partial<ThreeDS2Value[S][K]>) {
    onChange({ ...v, [section]: { ...(v[section] as object), [key]: { ...(v[section][key] as object), ...patch } } });
  }
  function setMriField<K extends keyof ThreeDS2Value['purchase']['merchantRiskIndicator']>(key: K, patch: Partial<ThreeDS2Value['purchase']['merchantRiskIndicator'][K]>) {
    onChange({ ...v, purchase: { ...v.purchase, merchantRiskIndicator: { ...v.purchase.merchantRiskIndicator, [key]: { ...v.purchase.merchantRiskIndicator[key], ...patch } } } });
  }

  return (
    <div className="threedss2-editor" style={d ? { opacity: 0.5 } : {}}>
      <ThreeDS2FieldRow label="deviceChannel"       field={v.deviceChannel}       savedField={sv?.deviceChannel}       parentDisabled={d} onToggle={() => setField('deviceChannel',       { included: !v.deviceChannel.included })}       onValueChange={val => setField('deviceChannel',       { value: val })} />
      <ThreeDS2FieldRow label="messageCategory"     field={v.messageCategory}     savedField={sv?.messageCategory}     parentDisabled={d} onToggle={() => setField('messageCategory',     { included: !v.messageCategory.included })}     onValueChange={val => setField('messageCategory',     { value: val })} />
      <ThreeDS2FieldRow label="threeDSCompIn"       field={v.threeDSCompIn}       savedField={sv?.threeDSCompIn}       parentDisabled={d} onToggle={() => setField('threeDSCompIn',       { included: !v.threeDSCompIn.included })}       onValueChange={val => setField('threeDSCompIn',       { value: val })} />
      <ThreeDS2FieldRow label="threeDSRequestorURL" field={v.threeDSRequestorURL} savedField={sv?.threeDSRequestorURL} parentDisabled={d} onToggle={() => setField('threeDSRequestorURL', { included: !v.threeDSRequestorURL.included })} onValueChange={val => setField('threeDSRequestorURL', { value: val })} />

      <ThreeDS2SectionHeader title="threeDSRequestor" />
      <ThreeDS2FieldRow label="threeDSRequestorAuthenticationInd" field={v.threeDSRequestor.threeDSRequestorAuthenticationInd} savedField={sv?.threeDSRequestor.threeDSRequestorAuthenticationInd} parentDisabled={d} onToggle={() => setSectionField('threeDSRequestor', 'threeDSRequestorAuthenticationInd', { included: !v.threeDSRequestor.threeDSRequestorAuthenticationInd.included })} onValueChange={val => setSectionField('threeDSRequestor', 'threeDSRequestorAuthenticationInd', { value: val })} />
      <ThreeDS2FieldRow label="threeDSReqAuthMethod"              field={v.threeDSRequestor.threeDSReqAuthMethod}              savedField={sv?.threeDSRequestor.threeDSReqAuthMethod}              parentDisabled={d} onToggle={() => setSectionField('threeDSRequestor', 'threeDSReqAuthMethod',              { included: !v.threeDSRequestor.threeDSReqAuthMethod.included })}              onValueChange={val => setSectionField('threeDSRequestor', 'threeDSReqAuthMethod',              { value: val })} />
      <ThreeDS2FieldRow label="threeDSReqAuthTimestamp"           field={v.threeDSRequestor.threeDSReqAuthTimestamp}           savedField={sv?.threeDSRequestor.threeDSReqAuthTimestamp}           parentDisabled={d} onToggle={() => setSectionField('threeDSRequestor', 'threeDSReqAuthTimestamp',           { included: !v.threeDSRequestor.threeDSReqAuthTimestamp.included })}           onValueChange={val => setSectionField('threeDSRequestor', 'threeDSReqAuthTimestamp',           { value: val })} />
      <ThreeDS2FieldRow label="threeDSReqAuthData"                field={v.threeDSRequestor.threeDSReqAuthData}                savedField={sv?.threeDSRequestor.threeDSReqAuthData}                parentDisabled={d} onToggle={() => setSectionField('threeDSRequestor', 'threeDSReqAuthData',                { included: !v.threeDSRequestor.threeDSReqAuthData.included })}                onValueChange={val => setSectionField('threeDSRequestor', 'threeDSReqAuthData',                { value: val })} />
      <ThreeDS2FieldRow label="threeDSRequestorChallengeInd"      field={v.threeDSRequestor.threeDSRequestorChallengeInd}      savedField={sv?.threeDSRequestor.threeDSRequestorChallengeInd}      parentDisabled={d} onToggle={() => setSectionField('threeDSRequestor', 'threeDSRequestorChallengeInd',      { included: !v.threeDSRequestor.threeDSRequestorChallengeInd.included })}      onValueChange={val => setSectionField('threeDSRequestor', 'threeDSRequestorChallengeInd',      { value: val })} />
      <ThreeDS2FieldRow label="threeDSReqPriorRef"                field={v.threeDSRequestor.threeDSReqPriorRef}                savedField={sv?.threeDSRequestor.threeDSReqPriorRef}                parentDisabled={d} onToggle={() => setSectionField('threeDSRequestor', 'threeDSReqPriorRef',                { included: !v.threeDSRequestor.threeDSReqPriorRef.included })}                onValueChange={val => setSectionField('threeDSRequestor', 'threeDSReqPriorRef',                { value: val })} />
      <ThreeDS2FieldRow label="threeDSReqPriorAuthMethod"         field={v.threeDSRequestor.threeDSReqPriorAuthMethod}         savedField={sv?.threeDSRequestor.threeDSReqPriorAuthMethod}         parentDisabled={d} onToggle={() => setSectionField('threeDSRequestor', 'threeDSReqPriorAuthMethod',         { included: !v.threeDSRequestor.threeDSReqPriorAuthMethod.included })}         onValueChange={val => setSectionField('threeDSRequestor', 'threeDSReqPriorAuthMethod',         { value: val })} />
      <ThreeDS2FieldRow label="threeDSReqPriorAuthTimestamp"      field={v.threeDSRequestor.threeDSReqPriorAuthTimestamp}      savedField={sv?.threeDSRequestor.threeDSReqPriorAuthTimestamp}      parentDisabled={d} onToggle={() => setSectionField('threeDSRequestor', 'threeDSReqPriorAuthTimestamp',      { included: !v.threeDSRequestor.threeDSReqPriorAuthTimestamp.included })}      onValueChange={val => setSectionField('threeDSRequestor', 'threeDSReqPriorAuthTimestamp',      { value: val })} />
      <ThreeDS2FieldRow label="threeDSReqPriorAuthData"           field={v.threeDSRequestor.threeDSReqPriorAuthData}           savedField={sv?.threeDSRequestor.threeDSReqPriorAuthData}           parentDisabled={d} onToggle={() => setSectionField('threeDSRequestor', 'threeDSReqPriorAuthData',           { included: !v.threeDSRequestor.threeDSReqPriorAuthData.included })}           onValueChange={val => setSectionField('threeDSRequestor', 'threeDSReqPriorAuthData',           { value: val })} />

      <ThreeDS2SectionHeader title="cardholderAccount" />
      <ThreeDS2FieldRow label="acctId"               field={v.cardholderAccount.acctId}               savedField={sv?.cardholderAccount.acctId}               parentDisabled={d} onToggle={() => setSectionField('cardholderAccount', 'acctId',               { included: !v.cardholderAccount.acctId.included })}               onValueChange={val => setSectionField('cardholderAccount', 'acctId',               { value: val })} />
      <ThreeDS2FieldRow label="chAccAgeInd"          field={v.cardholderAccount.chAccAgeInd}          savedField={sv?.cardholderAccount.chAccAgeInd}          parentDisabled={d} onToggle={() => setSectionField('cardholderAccount', 'chAccAgeInd',          { included: !v.cardholderAccount.chAccAgeInd.included })}          onValueChange={val => setSectionField('cardholderAccount', 'chAccAgeInd',          { value: val })} />
      <ThreeDS2FieldRow label="chAccDate"            field={v.cardholderAccount.chAccDate}            savedField={sv?.cardholderAccount.chAccDate}            parentDisabled={d} onToggle={() => setSectionField('cardholderAccount', 'chAccDate',            { included: !v.cardholderAccount.chAccDate.included })}            onValueChange={val => setSectionField('cardholderAccount', 'chAccDate',            { value: val })} />
      <ThreeDS2FieldRow label="chAccChangeInd"       field={v.cardholderAccount.chAccChangeInd}       savedField={sv?.cardholderAccount.chAccChangeInd}       parentDisabled={d} onToggle={() => setSectionField('cardholderAccount', 'chAccChangeInd',       { included: !v.cardholderAccount.chAccChangeInd.included })}       onValueChange={val => setSectionField('cardholderAccount', 'chAccChangeInd',       { value: val })} />
      <ThreeDS2FieldRow label="chAccChange"          field={v.cardholderAccount.chAccChange}          savedField={sv?.cardholderAccount.chAccChange}          parentDisabled={d} onToggle={() => setSectionField('cardholderAccount', 'chAccChange',          { included: !v.cardholderAccount.chAccChange.included })}          onValueChange={val => setSectionField('cardholderAccount', 'chAccChange',          { value: val })} />
      <ThreeDS2FieldRow label="chAccPwChangeInd"     field={v.cardholderAccount.chAccPwChangeInd}     savedField={sv?.cardholderAccount.chAccPwChangeInd}     parentDisabled={d} onToggle={() => setSectionField('cardholderAccount', 'chAccPwChangeInd',     { included: !v.cardholderAccount.chAccPwChangeInd.included })}     onValueChange={val => setSectionField('cardholderAccount', 'chAccPwChangeInd',     { value: val })} />
      <ThreeDS2FieldRow label="chAccPwChange"        field={v.cardholderAccount.chAccPwChange}        savedField={sv?.cardholderAccount.chAccPwChange}        parentDisabled={d} onToggle={() => setSectionField('cardholderAccount', 'chAccPwChange',        { included: !v.cardholderAccount.chAccPwChange.included })}        onValueChange={val => setSectionField('cardholderAccount', 'chAccPwChange',        { value: val })} />
      <ThreeDS2FieldRow label="shipAddressUsageInd"  field={v.cardholderAccount.shipAddressUsageInd}  savedField={sv?.cardholderAccount.shipAddressUsageInd}  parentDisabled={d} onToggle={() => setSectionField('cardholderAccount', 'shipAddressUsageInd',  { included: !v.cardholderAccount.shipAddressUsageInd.included })}  onValueChange={val => setSectionField('cardholderAccount', 'shipAddressUsageInd',  { value: val })} />
      <ThreeDS2FieldRow label="shipAddressUsage"     field={v.cardholderAccount.shipAddressUsage}     savedField={sv?.cardholderAccount.shipAddressUsage}     parentDisabled={d} onToggle={() => setSectionField('cardholderAccount', 'shipAddressUsage',     { included: !v.cardholderAccount.shipAddressUsage.included })}     onValueChange={val => setSectionField('cardholderAccount', 'shipAddressUsage',     { value: val })} />
      <ThreeDS2FieldRow label="txnActivityDay"       field={v.cardholderAccount.txnActivityDay}       savedField={sv?.cardholderAccount.txnActivityDay}       parentDisabled={d} onToggle={() => setSectionField('cardholderAccount', 'txnActivityDay',       { included: !v.cardholderAccount.txnActivityDay.included })}       onValueChange={val => setSectionField('cardholderAccount', 'txnActivityDay',       { value: val })} />
      <ThreeDS2FieldRow label="txnActivityYear"      field={v.cardholderAccount.txnActivityYear}      savedField={sv?.cardholderAccount.txnActivityYear}      parentDisabled={d} onToggle={() => setSectionField('cardholderAccount', 'txnActivityYear',      { included: !v.cardholderAccount.txnActivityYear.included })}      onValueChange={val => setSectionField('cardholderAccount', 'txnActivityYear',      { value: val })} />
      <ThreeDS2FieldRow label="provisionAttemptsDay" field={v.cardholderAccount.provisionAttemptsDay} savedField={sv?.cardholderAccount.provisionAttemptsDay} parentDisabled={d} onToggle={() => setSectionField('cardholderAccount', 'provisionAttemptsDay', { included: !v.cardholderAccount.provisionAttemptsDay.included })} onValueChange={val => setSectionField('cardholderAccount', 'provisionAttemptsDay', { value: val })} />
      <ThreeDS2FieldRow label="nbPurchaseAccount"    field={v.cardholderAccount.nbPurchaseAccount}    savedField={sv?.cardholderAccount.nbPurchaseAccount}    parentDisabled={d} onToggle={() => setSectionField('cardholderAccount', 'nbPurchaseAccount',    { included: !v.cardholderAccount.nbPurchaseAccount.included })}    onValueChange={val => setSectionField('cardholderAccount', 'nbPurchaseAccount',    { value: val })} />
      <ThreeDS2FieldRow label="suspiciousAccActivity"field={v.cardholderAccount.suspiciousAccActivity}savedField={sv?.cardholderAccount.suspiciousAccActivity}parentDisabled={d} onToggle={() => setSectionField('cardholderAccount', 'suspiciousAccActivity',{ included: !v.cardholderAccount.suspiciousAccActivity.included })} onValueChange={val => setSectionField('cardholderAccount', 'suspiciousAccActivity',{ value: val })} />
      <ThreeDS2FieldRow label="shipNameIndicator"    field={v.cardholderAccount.shipNameIndicator}    savedField={sv?.cardholderAccount.shipNameIndicator}    parentDisabled={d} onToggle={() => setSectionField('cardholderAccount', 'shipNameIndicator',    { included: !v.cardholderAccount.shipNameIndicator.included })}    onValueChange={val => setSectionField('cardholderAccount', 'shipNameIndicator',    { value: val })} />
      <ThreeDS2FieldRow label="paymentAccInd"        field={v.cardholderAccount.paymentAccInd}        savedField={sv?.cardholderAccount.paymentAccInd}        parentDisabled={d} onToggle={() => setSectionField('cardholderAccount', 'paymentAccInd',        { included: !v.cardholderAccount.paymentAccInd.included })}        onValueChange={val => setSectionField('cardholderAccount', 'paymentAccInd',        { value: val })} />
      <ThreeDS2FieldRow label="paymentAccAge"        field={v.cardholderAccount.paymentAccAge}        savedField={sv?.cardholderAccount.paymentAccAge}        parentDisabled={d} onToggle={() => setSectionField('cardholderAccount', 'paymentAccAge',        { included: !v.cardholderAccount.paymentAccAge.included })}        onValueChange={val => setSectionField('cardholderAccount', 'paymentAccAge',        { value: val })} />

      <ThreeDS2SectionHeader title="cardholder" />
      <ThreeDS2FieldRow label="addrMatch"       field={v.cardholder.addrMatch}       savedField={sv?.cardholder.addrMatch}       parentDisabled={d} onToggle={() => setSectionField('cardholder', 'addrMatch',       { included: !v.cardholder.addrMatch.included })}       onValueChange={val => setSectionField('cardholder', 'addrMatch',       { value: val })} />
      <ThreeDS2FieldRow label="billAddrCity"    field={v.cardholder.billAddrCity}    savedField={sv?.cardholder.billAddrCity}    parentDisabled={d} onToggle={() => setSectionField('cardholder', 'billAddrCity',    { included: !v.cardholder.billAddrCity.included })}    onValueChange={val => setSectionField('cardholder', 'billAddrCity',    { value: val })} />
      <ThreeDS2FieldRow label="billAddrCountry" field={v.cardholder.billAddrCountry} savedField={sv?.cardholder.billAddrCountry} parentDisabled={d} onToggle={() => setSectionField('cardholder', 'billAddrCountry', { included: !v.cardholder.billAddrCountry.included })} onValueChange={val => setSectionField('cardholder', 'billAddrCountry', { value: val })} />
      <ThreeDS2FieldRow label="billAddrLine1"   field={v.cardholder.billAddrLine1}   savedField={sv?.cardholder.billAddrLine1}   parentDisabled={d} onToggle={() => setSectionField('cardholder', 'billAddrLine1',   { included: !v.cardholder.billAddrLine1.included })}   onValueChange={val => setSectionField('cardholder', 'billAddrLine1',   { value: val })} />
      <ThreeDS2FieldRow label="billAddrLine2"   field={v.cardholder.billAddrLine2}   savedField={sv?.cardholder.billAddrLine2}   parentDisabled={d} onToggle={() => setSectionField('cardholder', 'billAddrLine2',   { included: !v.cardholder.billAddrLine2.included })}   onValueChange={val => setSectionField('cardholder', 'billAddrLine2',   { value: val })} />
      <ThreeDS2FieldRow label="billAddrLine3"   field={v.cardholder.billAddrLine3}   savedField={sv?.cardholder.billAddrLine3}   parentDisabled={d} onToggle={() => setSectionField('cardholder', 'billAddrLine3',   { included: !v.cardholder.billAddrLine3.included })}   onValueChange={val => setSectionField('cardholder', 'billAddrLine3',   { value: val })} />
      <ThreeDS2FieldRow label="billAddrPostCode"field={v.cardholder.billAddrPostCode}savedField={sv?.cardholder.billAddrPostCode}parentDisabled={d} onToggle={() => setSectionField('cardholder', 'billAddrPostCode',{ included: !v.cardholder.billAddrPostCode.included })} onValueChange={val => setSectionField('cardholder', 'billAddrPostCode',{ value: val })} />
      <ThreeDS2FieldRow label="billAddrState"   field={v.cardholder.billAddrState}   savedField={sv?.cardholder.billAddrState}   parentDisabled={d} onToggle={() => setSectionField('cardholder', 'billAddrState',   { included: !v.cardholder.billAddrState.included })}   onValueChange={val => setSectionField('cardholder', 'billAddrState',   { value: val })} />
      <ThreeDS2FieldRow label="email"           field={v.cardholder.email}           savedField={sv?.cardholder.email}           parentDisabled={d} onToggle={() => setSectionField('cardholder', 'email',           { included: !v.cardholder.email.included })}           onValueChange={val => setSectionField('cardholder', 'email',           { value: val })} />
      <PhoneFieldRow label="homePhone"   field={v.cardholder.homePhone}   savedField={sv?.cardholder.homePhone}   parentDisabled={d} onToggle={() => setSectionField('cardholder', 'homePhone',   { included: !v.cardholder.homePhone.included })}   onValueChange={val => setSectionField('cardholder', 'homePhone',   { value: val })} />
      <PhoneFieldRow label="mobilePhone" field={v.cardholder.mobilePhone} savedField={sv?.cardholder.mobilePhone} parentDisabled={d} onToggle={() => setSectionField('cardholder', 'mobilePhone', { included: !v.cardholder.mobilePhone.included })} onValueChange={val => setSectionField('cardholder', 'mobilePhone', { value: val })} />
      <PhoneFieldRow label="workPhone"   field={v.cardholder.workPhone}   savedField={sv?.cardholder.workPhone}   parentDisabled={d} onToggle={() => setSectionField('cardholder', 'workPhone',   { included: !v.cardholder.workPhone.included })}   onValueChange={val => setSectionField('cardholder', 'workPhone',   { value: val })} />
      <ThreeDS2FieldRow label="cardholderName"  field={v.cardholder.cardholderName}  savedField={sv?.cardholder.cardholderName}  parentDisabled={d} onToggle={() => setSectionField('cardholder', 'cardholderName',  { included: !v.cardholder.cardholderName.included })}  onValueChange={val => setSectionField('cardholder', 'cardholderName',  { value: val })} />
      <ThreeDS2FieldRow label="shipAddrCity"    field={v.cardholder.shipAddrCity}    savedField={sv?.cardholder.shipAddrCity}    parentDisabled={d} onToggle={() => setSectionField('cardholder', 'shipAddrCity',    { included: !v.cardholder.shipAddrCity.included })}    onValueChange={val => setSectionField('cardholder', 'shipAddrCity',    { value: val })} />
      <ThreeDS2FieldRow label="shipAddrCountry" field={v.cardholder.shipAddrCountry} savedField={sv?.cardholder.shipAddrCountry} parentDisabled={d} onToggle={() => setSectionField('cardholder', 'shipAddrCountry', { included: !v.cardholder.shipAddrCountry.included })} onValueChange={val => setSectionField('cardholder', 'shipAddrCountry', { value: val })} />
      <ThreeDS2FieldRow label="shipAddrLine1"   field={v.cardholder.shipAddrLine1}   savedField={sv?.cardholder.shipAddrLine1}   parentDisabled={d} onToggle={() => setSectionField('cardholder', 'shipAddrLine1',   { included: !v.cardholder.shipAddrLine1.included })}   onValueChange={val => setSectionField('cardholder', 'shipAddrLine1',   { value: val })} />
      <ThreeDS2FieldRow label="shipAddrLine2"   field={v.cardholder.shipAddrLine2}   savedField={sv?.cardholder.shipAddrLine2}   parentDisabled={d} onToggle={() => setSectionField('cardholder', 'shipAddrLine2',   { included: !v.cardholder.shipAddrLine2.included })}   onValueChange={val => setSectionField('cardholder', 'shipAddrLine2',   { value: val })} />
      <ThreeDS2FieldRow label="shipAddrLine3"   field={v.cardholder.shipAddrLine3}   savedField={sv?.cardholder.shipAddrLine3}   parentDisabled={d} onToggle={() => setSectionField('cardholder', 'shipAddrLine3',   { included: !v.cardholder.shipAddrLine3.included })}   onValueChange={val => setSectionField('cardholder', 'shipAddrLine3',   { value: val })} />
      <ThreeDS2FieldRow label="shipAddrPostCode"field={v.cardholder.shipAddrPostCode}savedField={sv?.cardholder.shipAddrPostCode}parentDisabled={d} onToggle={() => setSectionField('cardholder', 'shipAddrPostCode',{ included: !v.cardholder.shipAddrPostCode.included })} onValueChange={val => setSectionField('cardholder', 'shipAddrPostCode',{ value: val })} />
      <ThreeDS2FieldRow label="shipAddrState"   field={v.cardholder.shipAddrState}   savedField={sv?.cardholder.shipAddrState}   parentDisabled={d} onToggle={() => setSectionField('cardholder', 'shipAddrState',   { included: !v.cardholder.shipAddrState.included })}   onValueChange={val => setSectionField('cardholder', 'shipAddrState',   { value: val })} />

      <ThreeDS2SectionHeader title="purchase" />
      <ThreeDS2FieldRow label="purchaseAmount"    field={v.purchase.purchaseAmount}    savedField={sv?.purchase.purchaseAmount}    parentDisabled={d} onToggle={() => setSectionField('purchase', 'purchaseAmount',    { included: !v.purchase.purchaseAmount.included })}    onValueChange={val => setSectionField('purchase', 'purchaseAmount',    { value: val })} />
      <ThreeDS2FieldRow label="purchaseCurrency"  field={v.purchase.purchaseCurrency}  savedField={sv?.purchase.purchaseCurrency}  parentDisabled={d} onToggle={() => setSectionField('purchase', 'purchaseCurrency',  { included: !v.purchase.purchaseCurrency.included })}  onValueChange={val => setSectionField('purchase', 'purchaseCurrency',  { value: val })} />
      <ThreeDS2FieldRow label="purchaseExponent"  field={v.purchase.purchaseExponent}  savedField={sv?.purchase.purchaseExponent}  parentDisabled={d} onToggle={() => setSectionField('purchase', 'purchaseExponent',  { included: !v.purchase.purchaseExponent.included })}  onValueChange={val => setSectionField('purchase', 'purchaseExponent',  { value: val })} />
      <ThreeDS2FieldRow label="purchaseInstalData"field={v.purchase.purchaseInstalData}savedField={sv?.purchase.purchaseInstalData}parentDisabled={d} onToggle={() => setSectionField('purchase', 'purchaseInstalData',{ included: !v.purchase.purchaseInstalData.included })} onValueChange={val => setSectionField('purchase', 'purchaseInstalData',{ value: val })} />
      <ThreeDS2FieldRow label="purchaseDate"      field={v.purchase.purchaseDate}      savedField={sv?.purchase.purchaseDate}      parentDisabled={d} onToggle={() => setSectionField('purchase', 'purchaseDate',      { included: !v.purchase.purchaseDate.included })}      onValueChange={val => setSectionField('purchase', 'purchaseDate',      { value: val })} />
      <ThreeDS2FieldRow label="recurringExpiry"   field={v.purchase.recurringExpiry}   savedField={sv?.purchase.recurringExpiry}   parentDisabled={d} onToggle={() => setSectionField('purchase', 'recurringExpiry',   { included: !v.purchase.recurringExpiry.included })}   onValueChange={val => setSectionField('purchase', 'recurringExpiry',   { value: val })} />
      <ThreeDS2FieldRow label="recurringFrequency"field={v.purchase.recurringFrequency}savedField={sv?.purchase.recurringFrequency}parentDisabled={d} onToggle={() => setSectionField('purchase', 'recurringFrequency',{ included: !v.purchase.recurringFrequency.included })} onValueChange={val => setSectionField('purchase', 'recurringFrequency',{ value: val })} />
      <ThreeDS2FieldRow label="transType"         field={v.purchase.transType}         savedField={sv?.purchase.transType}         parentDisabled={d} onToggle={() => setSectionField('purchase', 'transType',         { included: !v.purchase.transType.included })}         onValueChange={val => setSectionField('purchase', 'transType',         { value: val })} />
      <ThreeDS2SectionHeader title="merchantRiskIndicator" />
      <ThreeDS2FieldRow label="shipIndicator"        field={v.purchase.merchantRiskIndicator.shipIndicator}        savedField={sv?.purchase.merchantRiskIndicator.shipIndicator}        parentDisabled={d} onToggle={() => setMriField('shipIndicator',        { included: !v.purchase.merchantRiskIndicator.shipIndicator.included })}        onValueChange={val => setMriField('shipIndicator',        { value: val })} />
      <ThreeDS2FieldRow label="deliveryTimeframe"    field={v.purchase.merchantRiskIndicator.deliveryTimeframe}    savedField={sv?.purchase.merchantRiskIndicator.deliveryTimeframe}    parentDisabled={d} onToggle={() => setMriField('deliveryTimeframe',    { included: !v.purchase.merchantRiskIndicator.deliveryTimeframe.included })}    onValueChange={val => setMriField('deliveryTimeframe',    { value: val })} />
      <ThreeDS2FieldRow label="deliveryEmailAddress" field={v.purchase.merchantRiskIndicator.deliveryEmailAddress} savedField={sv?.purchase.merchantRiskIndicator.deliveryEmailAddress} parentDisabled={d} onToggle={() => setMriField('deliveryEmailAddress', { included: !v.purchase.merchantRiskIndicator.deliveryEmailAddress.included })} onValueChange={val => setMriField('deliveryEmailAddress', { value: val })} />
      <ThreeDS2FieldRow label="reorderItemsInd"      field={v.purchase.merchantRiskIndicator.reorderItemsInd}      savedField={sv?.purchase.merchantRiskIndicator.reorderItemsInd}      parentDisabled={d} onToggle={() => setMriField('reorderItemsInd',      { included: !v.purchase.merchantRiskIndicator.reorderItemsInd.included })}      onValueChange={val => setMriField('reorderItemsInd',      { value: val })} />
      <ThreeDS2FieldRow label="preOrderPurchaseInd"  field={v.purchase.merchantRiskIndicator.preOrderPurchaseInd}  savedField={sv?.purchase.merchantRiskIndicator.preOrderPurchaseInd}  parentDisabled={d} onToggle={() => setMriField('preOrderPurchaseInd',  { included: !v.purchase.merchantRiskIndicator.preOrderPurchaseInd.included })}  onValueChange={val => setMriField('preOrderPurchaseInd',  { value: val })} />
      <ThreeDS2FieldRow label="preOrderDate"         field={v.purchase.merchantRiskIndicator.preOrderDate}         savedField={sv?.purchase.merchantRiskIndicator.preOrderDate}         parentDisabled={d} onToggle={() => setMriField('preOrderDate',         { included: !v.purchase.merchantRiskIndicator.preOrderDate.included })}         onValueChange={val => setMriField('preOrderDate',         { value: val })} />
      <ThreeDS2FieldRow label="giftCardAmount"       field={v.purchase.merchantRiskIndicator.giftCardAmount}       savedField={sv?.purchase.merchantRiskIndicator.giftCardAmount}       parentDisabled={d} onToggle={() => setMriField('giftCardAmount',       { included: !v.purchase.merchantRiskIndicator.giftCardAmount.included })}       onValueChange={val => setMriField('giftCardAmount',       { value: val })} />
      <ThreeDS2FieldRow label="giftCardCurr"         field={v.purchase.merchantRiskIndicator.giftCardCurr}         savedField={sv?.purchase.merchantRiskIndicator.giftCardCurr}         parentDisabled={d} onToggle={() => setMriField('giftCardCurr',         { included: !v.purchase.merchantRiskIndicator.giftCardCurr.included })}         onValueChange={val => setMriField('giftCardCurr',         { value: val })} />
      <ThreeDS2FieldRow label="giftCardCount"        field={v.purchase.merchantRiskIndicator.giftCardCount}        savedField={sv?.purchase.merchantRiskIndicator.giftCardCount}        parentDisabled={d} onToggle={() => setMriField('giftCardCount',        { included: !v.purchase.merchantRiskIndicator.giftCardCount.included })}        onValueChange={val => setMriField('giftCardCount',        { value: val })} />

      <ThreeDS2SectionHeader title="acquirer" />
      <ThreeDS2FieldRow label="acquirerBin"        field={v.acquirer.acquirerBin}        savedField={sv?.acquirer.acquirerBin}        parentDisabled={d} onToggle={() => setSectionField('acquirer', 'acquirerBin',        { included: !v.acquirer.acquirerBin.included })}        onValueChange={val => setSectionField('acquirer', 'acquirerBin',        { value: val })} />
      <ThreeDS2FieldRow label="acquirerMerchantId" field={v.acquirer.acquirerMerchantId} savedField={sv?.acquirer.acquirerMerchantId} parentDisabled={d} onToggle={() => setSectionField('acquirer', 'acquirerMerchantId', { included: !v.acquirer.acquirerMerchantId.included })} onValueChange={val => setSectionField('acquirer', 'acquirerMerchantId', { value: val })} />

      <ThreeDS2SectionHeader title="merchant" />
      <ThreeDS2FieldRow label="mcc"                field={v.merchant.mcc}                savedField={sv?.merchant.mcc}                parentDisabled={d} onToggle={() => setSectionField('merchant', 'mcc',                { included: !v.merchant.mcc.included })}                onValueChange={val => setSectionField('merchant', 'mcc',                { value: val })} />
      <ThreeDS2FieldRow label="merchantCountryCode"field={v.merchant.merchantCountryCode}savedField={sv?.merchant.merchantCountryCode}parentDisabled={d} onToggle={() => setSectionField('merchant', 'merchantCountryCode',{ included: !v.merchant.merchantCountryCode.included })} onValueChange={val => setSectionField('merchant', 'merchantCountryCode',{ value: val })} />
      <ThreeDS2FieldRow label="merchantName"       field={v.merchant.merchantName}       savedField={sv?.merchant.merchantName}       parentDisabled={d} onToggle={() => setSectionField('merchant', 'merchantName',       { included: !v.merchant.merchantName.included })}       onValueChange={val => setSectionField('merchant', 'merchantName',       { value: val })} />

      <ThreeDS2SectionHeader title="browserInformation" />
      <ThreeDS2FieldRow label="browserAcceptHeader"     field={v.browserInformation.browserAcceptHeader}     savedField={sv?.browserInformation.browserAcceptHeader}     parentDisabled={d} onToggle={() => setSectionField('browserInformation', 'browserAcceptHeader',     { included: !v.browserInformation.browserAcceptHeader.included })}     onValueChange={val => setSectionField('browserInformation', 'browserAcceptHeader',     { value: val })} />
      <ThreeDS2FieldRow label="browserIP"               field={v.browserInformation.browserIP}               savedField={sv?.browserInformation.browserIP}               parentDisabled={d} onToggle={() => setSectionField('browserInformation', 'browserIP',               { included: !v.browserInformation.browserIP.included })}               onValueChange={val => setSectionField('browserInformation', 'browserIP',               { value: val })} />
      <ThreeDS2FieldRow label="browserJavaEnabled"      field={v.browserInformation.browserJavaEnabled}      savedField={sv?.browserInformation.browserJavaEnabled}      parentDisabled={d} onToggle={() => setSectionField('browserInformation', 'browserJavaEnabled',      { included: !v.browserInformation.browserJavaEnabled.included })}      onValueChange={val => setSectionField('browserInformation', 'browserJavaEnabled',      { value: val })} />
      <ThreeDS2FieldRow label="browserJavascriptEnabled"field={v.browserInformation.browserJavascriptEnabled}savedField={sv?.browserInformation.browserJavascriptEnabled}parentDisabled={d} onToggle={() => setSectionField('browserInformation', 'browserJavascriptEnabled',{ included: !v.browserInformation.browserJavascriptEnabled.included })} onValueChange={val => setSectionField('browserInformation', 'browserJavascriptEnabled',{ value: val })} />
      <ThreeDS2FieldRow label="browserLanguage"         field={v.browserInformation.browserLanguage}         savedField={sv?.browserInformation.browserLanguage}         parentDisabled={d} onToggle={() => setSectionField('browserInformation', 'browserLanguage',         { included: !v.browserInformation.browserLanguage.included })}         onValueChange={val => setSectionField('browserInformation', 'browserLanguage',         { value: val })} />
      <ThreeDS2FieldRow label="browserColorDepth"       field={v.browserInformation.browserColorDepth}       savedField={sv?.browserInformation.browserColorDepth}       parentDisabled={d} onToggle={() => setSectionField('browserInformation', 'browserColorDepth',       { included: !v.browserInformation.browserColorDepth.included })}       onValueChange={val => setSectionField('browserInformation', 'browserColorDepth',       { value: val })} />
      <ThreeDS2FieldRow label="browserScreenHeight"     field={v.browserInformation.browserScreenHeight}     savedField={sv?.browserInformation.browserScreenHeight}     parentDisabled={d} onToggle={() => setSectionField('browserInformation', 'browserScreenHeight',     { included: !v.browserInformation.browserScreenHeight.included })}     onValueChange={val => setSectionField('browserInformation', 'browserScreenHeight',     { value: val })} />
      <ThreeDS2FieldRow label="browserScreenWidth"      field={v.browserInformation.browserScreenWidth}      savedField={sv?.browserInformation.browserScreenWidth}      parentDisabled={d} onToggle={() => setSectionField('browserInformation', 'browserScreenWidth',      { included: !v.browserInformation.browserScreenWidth.included })}      onValueChange={val => setSectionField('browserInformation', 'browserScreenWidth',      { value: val })} />
      <ThreeDS2FieldRow label="browserTZ"               field={v.browserInformation.browserTZ}               savedField={sv?.browserInformation.browserTZ}               parentDisabled={d} onToggle={() => setSectionField('browserInformation', 'browserTZ',               { included: !v.browserInformation.browserTZ.included })}               onValueChange={val => setSectionField('browserInformation', 'browserTZ',               { value: val })} />
      <ThreeDS2FieldRow label="browserUserAgent"        field={v.browserInformation.browserUserAgent}        savedField={sv?.browserInformation.browserUserAgent}        parentDisabled={d} onToggle={() => setSectionField('browserInformation', 'browserUserAgent',        { included: !v.browserInformation.browserUserAgent.included })}        onValueChange={val => setSectionField('browserInformation', 'browserUserAgent',        { value: val })} />
      <ThreeDS2FieldRow label="challengeWindowSize"     field={v.browserInformation.challengeWindowSize}     savedField={sv?.browserInformation.challengeWindowSize}     parentDisabled={d} onToggle={() => setSectionField('browserInformation', 'challengeWindowSize',     { included: !v.browserInformation.challengeWindowSize.included })}     onValueChange={val => setSectionField('browserInformation', 'challengeWindowSize',     { value: val })} />
    </div>
  );
}

// ── AttributesEditor ──────────────────────────────────────────────────────────

function AttributesEditor({
  attrs,
  savedAttrs,
  onChange,
  disabled = false,
}: {
  attrs: Record<string, string>;
  savedAttrs?: Record<string, string>;
  onChange: (attrs: Record<string, string>) => void;
  disabled?: boolean;
}) {
  const entries = Object.entries(attrs);
  const savedEntries = savedAttrs ? Object.entries(savedAttrs) : null;

  function isRowDirty(index: number, key: string, value: string): boolean {
    if (!savedEntries) return false;
    const saved = savedEntries[index];
    if (!saved) return true; // new row
    return saved[0] !== key || saved[1] !== value;
  }

  function handleKeyChange(oldKey: string, newKey: string) {
    const updated: Record<string, string> = {};
    for (const [k, v] of Object.entries(attrs)) {
      updated[k === oldKey ? newKey : k] = v;
    }
    onChange(updated);
  }

  function handleValueChange(key: string, newValue: string) {
    onChange({ ...attrs, [key]: newValue });
  }

  function handleRemove(key: string) {
    const updated = { ...attrs };
    delete updated[key];
    onChange(updated);
  }

  function handleAdd() {
    const base = 'key';
    let i = Object.keys(attrs).length + 1;
    while (attrs[`${base}${i}`] !== undefined) i++;
    onChange({ ...attrs, [`${base}${i}`]: '' });
  }

  return (
    <div className="attributes-editor" style={disabled ? { pointerEvents: 'none' } : {}}>
      {entries.length === 0 && (
        <p className="attr-empty">No attributes. Add one below.</p>
      )}
      {entries.map(([key, value], index) => (
        <div key={index} className={`attr-row${isRowDirty(index, key, value) ? ' attr-row-dirty' : ''}`}>
          <input
            className="attr-key-input"
            value={key}
            onChange={e => handleKeyChange(key, e.target.value)}
            placeholder="key"
            disabled={disabled}
          />
          <span className="attr-separator">:</span>
          <input
            className="attr-value-input"
            value={value}
            onChange={e => handleValueChange(key, e.target.value)}
            placeholder="value"
            disabled={disabled}
          />
          <button
            className="attr-remove-btn"
            onClick={() => handleRemove(key)}
            title="Remove"
            disabled={disabled}
          >
            ×
          </button>
        </div>
      ))}
      {!disabled && (
        <button className="attr-add-btn" onClick={handleAdd}>
          + Add attribute
        </button>
      )}
    </div>
  );
}

interface Props {
  endpoint: string;
  nestedField?: string[];
  onDirtyChange?: (dirty: boolean) => void;
}

export default function EndpointConfigPage({ endpoint, nestedField, onDirtyChange }: Props) {
  const [config, setConfig] = useState<ConfigRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [threeDS2Collapsed, setThreeDS2Collapsed] = useState(true);
  const savedConfigRef = useRef<string>('');
  const { confirm, dialogEl } = useConfirmDialog();

  function markClean(cfg: ConfigRecord[]) {
    savedConfigRef.current = JSON.stringify(cfg);
    setIsDirty(false);
    onDirtyChange?.(false);
  }

  function updateConfig(cfg: ConfigRecord[]) {
    setConfig(cfg);
    const dirty = JSON.stringify(cfg) !== savedConfigRef.current;
    setIsDirty(dirty);
    onDirtyChange?.(dirty);
  }

  // Guard for ResponseSetBar before switching sets
  async function confirmSwitch(): Promise<boolean> {
    if (!isDirty) return true;
    return confirm({
      title: 'Unsaved changes',
      message: 'You have unsaved changes. Switch set anyway?',
      confirmLabel: 'Switch',
      cancelLabel: 'Stay',
    });
  }

  // loading is cleared by ResponseSetBar when it delivers the first config
  useEffect(() => {
    setIsDirty(false);
    onDirtyChange?.(false);
    savedConfigRef.current = '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  const allIncluded = config.length > 0 && config.every(r => r.included);

  function handleToggleAll() {
    const nextState = !allIncluded;
    updateConfig(config.map(r => ({ ...r, included: nextState })));
  }

  function handleToggle(key: string) {
    updateConfig(config.map(r => r.key === key ? { ...r, included: !r.included } : r));
  }

  function handleValueChange(key: string, value: string) {
    updateConfig(config.map(r => r.key === key ? { ...r, value } : r));
  }

  function handleNestedChange(attrs: Record<string, unknown>, key?: string) {
    const targetKey = key ?? nestedField;
    updateConfig(config.map(r => r.key === targetKey ? { ...r, value: attrs } : r));
  }

  function handleApplyJson() {
    setJsonError('');
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonInput);
    } catch {
      setJsonError('Invalid JSON — please check your input and try again.');
      return;
    }

    if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
      setJsonError('Expected a JSON object at the top level.');
      return;
    }

    setConfig(cfg =>
      cfg.map(r => {
        if (!(r.key in parsed)) return r;

        if (r.key === 'threeDS2') {
          const raw = parsed[r.key];
          if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
            return { ...r, value: applyThreeDS2Json(r.value as unknown as ThreeDS2Value, raw as Record<string, unknown>) as unknown as Record<string, unknown> };
          }
          return r;
        }

        if (nestedField && nestedField.includes(r.key)) {
          const rawAttrs = parsed[r.key];
          if (rawAttrs !== null && typeof rawAttrs === 'object' && !Array.isArray(rawAttrs)) {
            const attrs: Record<string, string> = {};
            for (const [k, v] of Object.entries(rawAttrs as Record<string, unknown>)) {
              attrs[k] = String(v);
            }
            return { ...r, value: attrs };
          }
          return r;
        }

        return { ...r, value: String(parsed[r.key]) };
      })
    );

    setJsonInput('');
  }

  async function handleCopyJson() {
    const sorted = [...config].sort((a, b) => a.order - b.order);
    const responseBody: Record<string, unknown> = {};
    for (const record of sorted) {
      if (record.included) {
        if (record.key === 'threeDS2') {
          responseBody[record.key] = serializeThreeDS2Stored(record.value as unknown as ThreeDS2Stored);
        } else {
          responseBody[record.key] = record.value;
        }
      }
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(responseBody, null, 2));
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2500);
    } catch {
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 2500);
    }
  }

  const sorted = [...config].sort((a, b) => a.order - b.order);

  // Build a lookup of saved values for per-field dirty indicators
  const savedMap = useMemo<Record<string, ConfigRecord>>(() => {
    if (!savedConfigRef.current) return {};
    try {
      const arr = JSON.parse(savedConfigRef.current) as ConfigRecord[];
      return Object.fromEntries(arr.map(r => [r.key, r]));
    } catch {
      return {};
    }
  }, [savedConfigRef.current]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
    <div className="page">
      <ResponseSetBar
        endpoint={endpoint}
        config={config}
        isDirty={isDirty}
        onConfigChange={cfg => { setConfig(cfg); markClean(cfg); setLoading(false); }}
        onSaved={markClean}
        confirmSwitch={confirmSwitch}
      />
      <div className="page-header">
        <div>
          <h1 className="page-title">{endpoint}</h1>
          <p className="page-subtitle">
            Configure the response returned by <code>POST /{endpoint}</code>
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Response Parameters</h2>
          <div className="include-all-row">
            <span className="include-all-label">Include all</span>
            <button
              className={`toggle ${allIncluded ? 'toggle-on' : ''}`}
              onClick={handleToggleAll}
              role="switch"
              aria-checked={allIncluded}
            />
          </div>
        </div>

        {loading ? (
          <div className="page-loading">Loading configuration…</div>
        ) : (
        <div className="config-table">
          <div className="config-table-header">
            <span className="col-include">Include</span>
            <span className="col-key">Parameter</span>
            <span className="col-value">Value</span>
          </div>

          {sorted.map(record => {
            const savedRecord = savedMap[record.key];
            const isRowDirty = savedRecord !== undefined && (
              record.included !== savedRecord.included ||
              (record.key !== 'threeDS2' && !nestedField?.includes(record.key) &&
                record.value !== savedRecord.value)
            );
            return (
            <div
              key={record.key}
              className={`config-row ${!record.included ? 'row-disabled' : ''}${isRowDirty ? ' row-dirty' : ''}`}
            >
              <div className="col-include">
                <button
                  className={`toggle ${record.included ? 'toggle-on' : ''}`}
                  onClick={() => handleToggle(record.key)}
                  role="switch"
                  aria-checked={record.included}
                />
              </div>
              <div className="col-key">
                {record.key === 'threeDS2' ? (
                  <button
                    className="threedss2-collapse-btn"
                    onClick={() => setThreeDS2Collapsed(c => !c)}
                  >
                    <span className="threedss2-chevron">{threeDS2Collapsed ? '▶' : '▼'}</span>
                    <span className="param-key">threeDS2</span>
                  </button>
                ) : (
                  <span className="param-key">{record.key}</span>
                )}
              </div>
              <div className="col-value">
                {record.key === 'threeDS2' ? (
                  threeDS2Collapsed ? (
                    <span className="threedss2-collapsed-hint">{'{ … }'}</span>
                  ) : (
                    <ThreeDS2Editor
                      value={record.value as unknown as ThreeDS2Value}
                      savedValue={savedRecord?.value as unknown as ThreeDS2Value | undefined}
                      disabled={!record.included}
                      onChange={val => handleNestedChange(val as unknown as Record<string, unknown>, 'threeDS2')}
                    />
                  )
                ) : nestedField && nestedField.includes(record.key) ? (
                  <AttributesEditor
                    attrs={record.value as Record<string, string>}
                    savedAttrs={savedRecord?.value as Record<string, string> | undefined}
                    onChange={attrs => handleNestedChange(attrs, record.key)}
                    disabled={!record.included}
                  />
                ) : (
                  <input
                    className="field-input"
                    value={record.value as string}
                    onChange={e => handleValueChange(record.key, e.target.value)}
                    disabled={!record.included}
                  />
                )}
              </div>
            </div>
            );
          })}
        </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Export JSON</h2>
            <p className="card-description">
              Copy the current response body (included fields only) as a JSON object.
            </p>
          </div>
        </div>
        <div className="card-body">
          <div className="json-actions">
            <button className="btn btn-secondary" onClick={handleCopyJson}>
              Copy JSON
            </button>
            {copyStatus === 'copied' && (
              <span className="save-status success">Copied</span>
            )}
            {copyStatus === 'error' && (
              <span className="save-status error">Copy failed</span>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Import JSON</h2>
            <p className="card-description">
              Paste a complete {endpoint} JSON object to populate the fields above.
            </p>
          </div>
        </div>
        <div className="card-body">
          <textarea
            className="json-textarea"
            value={jsonInput}
            onChange={e => {
              setJsonInput(e.target.value);
              setJsonError('');
            }}
            placeholder={'{\n  "userId": "abc123",\n  ...\n}'}
            rows={7}
          />
          {jsonError && <p className="json-error">{jsonError}</p>}
          <div className="json-actions">
            <button
              className="btn btn-secondary"
              onClick={handleApplyJson}
              disabled={!jsonInput.trim()}
            >
              Apply JSON
            </button>
          </div>
        </div>
      </div>
    </div>
    {dialogEl}
    </>
  );
}
