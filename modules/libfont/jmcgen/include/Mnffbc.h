/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*-
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
/*******************************************************************************
 * Source date: 9 Apr 1997 21:45:13 GMT
 * netscape/fonts/nffbc public interface
 * Generated by jmc version 1.8 -- DO NOT EDIT
 ******************************************************************************/

#ifndef _Mnffbc_H_
#define _Mnffbc_H_

#include "jmc.h"

#ifdef __cplusplus
extern "C" {
#endif /* __cplusplus */

/*******************************************************************************
 * nffbc
 ******************************************************************************/

/* The type of the nffbc interface. */
struct nffbcInterface;

/* The public type of a nffbc instance. */
typedef struct nffbc {
	const struct nffbcInterface*	vtable;
} nffbc;

/* The inteface ID of the nffbc interface. */
#ifndef JMC_INIT_nffbc_ID
extern EXTERN_C_WITHOUT_EXTERN const JMCInterfaceID nffbc_ID;
#else
EXTERN_C const JMCInterfaceID nffbc_ID = { 0x073a4824, 0x11194410, 0x6b130d18, 0x6516741a };
#endif /* JMC_INIT_nffbc_ID */
/*******************************************************************************
 * nffbc Operations
 ******************************************************************************/

#define nffbc_getInterface(self, a, exception)	\
	(((self)->vtable->getInterface)(self, nffbc_getInterface_op, a, exception))

#define nffbc_addRef(self, exception)	\
	(((self)->vtable->addRef)(self, nffbc_addRef_op, exception))

#define nffbc_release(self, exception)	\
	(((self)->vtable->release)(self, nffbc_release_op, exception))

#define nffbc_hashCode(self, exception)	\
	(((self)->vtable->hashCode)(self, nffbc_hashCode_op, exception))

#define nffbc_equals(self, a, exception)	\
	(((self)->vtable->equals)(self, nffbc_equals_op, a, exception))

#define nffbc_clone(self, exception)	\
	(((self)->vtable->clone)(self, nffbc_clone_op, exception))

#define nffbc_toString(self, exception)	\
	(((self)->vtable->toString)(self, nffbc_toString_op, exception))

#define nffbc_finalize(self, exception)	\
	(((self)->vtable->finalize)(self, nffbc_finalize_op, exception))

#define nffbc_LookupFont(self, a, b, c, exception)	\
	(((self)->vtable->LookupFont)(self, nffbc_LookupFont_op, a, b, c, exception))

#define nffbc_CreateFontFromUrl(self, a, b, c, d, e, f, exception)	\
	(((self)->vtable->CreateFontFromUrl)(self, nffbc_CreateFontFromUrl_op, a, b, c, d, e, f, exception))

#define nffbc_CreateFontFromFile(self, a, b, c, d, exception)	\
	(((self)->vtable->CreateFontFromFile)(self, nffbc_CreateFontFromFile_op, a, b, c, d, exception))

#define nffbc_ListFonts(self, a, b, exception)	\
	(((self)->vtable->ListFonts)(self, nffbc_ListFonts_op, a, b, exception))

#define nffbc_ListSizes(self, a, b, exception)	\
	(((self)->vtable->ListSizes)(self, nffbc_ListSizes_op, a, b, exception))

#define nffbc_GetBaseFont(self, a, exception)	\
	(((self)->vtable->GetBaseFont)(self, nffbc_GetBaseFont_op, a, exception))

/*******************************************************************************
 * nffbc Interface
 ******************************************************************************/

struct netscape_jmc_JMCInterfaceID;
struct java_lang_Object;
struct java_lang_String;
struct netscape_fonts_nfrc;
struct netscape_fonts_nffmi;
struct netscape_jmc_ConstCString;
struct netscape_fonts_nff;
struct netscape_fonts_nfdoer;
struct netscape_fonts_MWCntxStar;
struct netscape_fonts_nfrf;

struct nffbcInterface {
	void*	(*getInterface)(struct nffbc* self, jint op, const JMCInterfaceID* a, JMCException* *exception);
	void	(*addRef)(struct nffbc* self, jint op, JMCException* *exception);
	void	(*release)(struct nffbc* self, jint op, JMCException* *exception);
	jint	(*hashCode)(struct nffbc* self, jint op, JMCException* *exception);
	jbool	(*equals)(struct nffbc* self, jint op, void* a, JMCException* *exception);
	void*	(*clone)(struct nffbc* self, jint op, JMCException* *exception);
	const char*	(*toString)(struct nffbc* self, jint op, JMCException* *exception);
	void	(*finalize)(struct nffbc* self, jint op, JMCException* *exception);
	struct nff*	(*LookupFont)(struct nffbc* self, jint op, struct nfrc* a, struct nffmi* b, const char* c, JMCException* *exception);
	struct nff*	(*CreateFontFromUrl)(struct nffbc* self, jint op, struct nfrc* a, const char* b, const char* c, jint d, struct nfdoer* e, MWContext * f, JMCException* *exception);
	struct nff*	(*CreateFontFromFile)(struct nffbc* self, jint op, struct nfrc* a, const char* b, const char* c, const char* d, JMCException* *exception);
	void*	(*ListFonts)(struct nffbc* self, jint op, struct nfrc* a, struct nffmi* b, JMCException* *exception);
	void*	(*ListSizes)(struct nffbc* self, jint op, struct nfrc* a, struct nffmi* b, JMCException* *exception);
	struct nff*	(*GetBaseFont)(struct nffbc* self, jint op, struct nfrf* a, JMCException* *exception);
};

/*******************************************************************************
 * nffbc Operation IDs
 ******************************************************************************/

typedef enum nffbcOperations {
	nffbc_getInterface_op,
	nffbc_addRef_op,
	nffbc_release_op,
	nffbc_hashCode_op,
	nffbc_equals_op,
	nffbc_clone_op,
	nffbc_toString_op,
	nffbc_finalize_op,
	nffbc_LookupFont_op,
	nffbc_CreateFontFromUrl_op,
	nffbc_CreateFontFromFile_op,
	nffbc_ListFonts_op,
	nffbc_ListSizes_op,
	nffbc_GetBaseFont_op
} nffbcOperations;

/******************************************************************************/

#ifdef __cplusplus
} /* extern "C" */
#endif /* __cplusplus */

#endif /* _Mnffbc_H_ */
