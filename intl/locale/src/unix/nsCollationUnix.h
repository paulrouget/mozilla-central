
/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * The contents of this file are subject to the Netscape Public
 * License Version 1.1 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of
 * the License at http://www.mozilla.org/NPL/
 *
 * Software distributed under the License is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the License for the specific language governing
 * rights and limitations under the License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is Netscape
 * Communications Corporation.  Portions created by Netscape are
 * Copyright (C) 1998 Netscape Communications Corporation. All
 * Rights Reserved.
 *
 * Contributor(s): 
 */
#ifndef nsCollationUnix_h__
#define nsCollationUnix_h__


#include "nsICollation.h"
#include "nsCollation.h"  // static library



class nsCollationUnix : public nsICollation {

protected:
  nsCollation   *mCollation;
  nsString      mLocale; //should be nsCString when available
  nsString      mCharset;

public: 
  NS_DECL_ISUPPORTS
    
  // compare two strings
  // result is same as strcmp
  NS_IMETHOD CompareString(const nsCollationStrength strength, 
                           const nsString& string1, const nsString& string2, PRInt32* result) 
                           {return mCollation->CompareString(this, strength, string1, string2, result);}

  // get a length (of character) of a sort key to be generated by an input string
  // length is character length not byte length 
  NS_IMETHOD GetSortKeyLen(const nsCollationStrength strength, 
                           const nsString& stringIn, PRUint32* outLen);

  // create sort key from input string
  // length is character length not byte length, caller to allocate a memory for a key
  NS_IMETHOD CreateRawSortKey(const nsCollationStrength strength, 
                              const nsString& stringIn, PRUint8* key, PRUint32* outLen);

  // create a sort key (nsString)
  NS_IMETHOD CreateSortKey(const nsCollationStrength strength, 
                           const nsString& stringIn, nsString& key)
                           {return mCollation->CreateSortKey(this, strength, stringIn, key);}

  // compare two sort keys
  // length is character length not byte length, result is same as strcmp
  NS_IMETHOD CompareRawSortKey(const PRUint8* key1, const PRUint32 len1, 
                               const PRUint8* key2, const PRUint32 len2, 
                               PRInt32* result) 
                               {*result = mCollation->CompareRawSortKey(key1, len1, key2, len2);return NS_OK;}

  // compare two sort keys (nsString)
  NS_IMETHOD CompareSortKey(const nsString& key1, const nsString& key2, PRInt32* result)
                            {*result = mCollation->CompareSortKey(key1, key2);return NS_OK;}

  // init this interface to a specified locale (should only be called by collation factory)
  //
  NS_IMETHOD Initialize(nsILocale* locale);

  nsCollationUnix();

  virtual ~nsCollationUnix(); 
};

#endif  /* nsCollationUnix_h__ */
