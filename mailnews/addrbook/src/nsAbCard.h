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

/********************************************************************************************************
 
   Interface for representing Address Book Directory
 
*********************************************************************************************************/

#ifndef nsAbCard_h__
#define nsAbCard_h__

#include "nsAbCardProperty.h"  
#include "nsAbRDFResource.h"
#include "nsISupportsArray.h"
#include "nsVoidArray.h"
#include "nsCOMPtr.h"
#include "nsIAddrDBListener.h"
#include "nsIAddrDatabase.h"

 /* 
  * Address Book Directory
  */ 

class nsAbCard: public nsAbRDFResource, public nsAbCardProperty
{
public: 

	NS_DECL_ISUPPORTS_INHERITED

	nsAbCard(void);
	virtual ~nsAbCard(void);

	// nsIAddrDBListener methods:
	NS_IMETHOD OnCardEntryChange(PRUint32 abCode, nsIAbCard *card, nsIAddrDBListener *instigator);
	
protected:

	nsresult NotifyPropertyChanged(char *property, PRUnichar* oldValue, PRUnichar* newValue);
	nsresult AddSubNode(nsAutoString name, nsIAbCard **childDir);

protected:
	 
	nsVoidArray *mListeners;
};

#endif
