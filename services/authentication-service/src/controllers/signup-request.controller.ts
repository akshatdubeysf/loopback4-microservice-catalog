// Uncomment these imports to begin using these cool features!

import {get, getModelSchemaRef, post, requestBody} from '@loopback/rest';
import {CONTENT_TYPE, ErrorCodes, STATUS_CODE} from '@sourceloop/core';
import {authorize} from 'loopback4-authorization';
import {SignupRequestDto} from '../models/signup-request-dto.model';
import {SignupRequestResponseDto} from '../models/signup-request-response-dto.model';
import * as jwt from 'jsonwebtoken';
import {LocalUserProfileDto} from '../models/local-user-profile';
import {SignupWithTokenReponseDto} from '../models/signup-with-token-response-dto.model';
import {inject} from '@loopback/core';
import {PreSignupFn, UserSignupFn} from '../types';
import {
  authenticate,
  AuthenticationBindings,
  STRATEGY,
} from 'loopback4-authentication';
import {SignupRequest} from '../models/signup-request.model';
import {SignUpBindings, VerifyBindings} from '../providers';

const basePath = 'sign-up';
export class SignupRequestController {
  constructor(
    @inject(SignUpBindings.PRE_LOCAL_SIGNUP_PROVIDER)
    private readonly preSignupFn: PreSignupFn<LocalUserProfileDto>,
    @inject(SignUpBindings.LOCAL_SIGNUP_PROVIDER)
    private readonly userSignupFn: UserSignupFn<LocalUserProfileDto>,
  ) {}

  @authorize({permissions: ['*']})
  @post(`auth/${basePath}/create-token`, {
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Success Response.',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: getModelSchemaRef(SignupRequestResponseDto),
          },
        },
      },
      ...ErrorCodes,
    },
  })
  async requestSignup(
    @requestBody()
    signUpRequest: SignupRequestDto,
  ): Promise<SignupRequestResponseDto> {
    // Default expiry is 30 minutes
    const expiryDuration = parseInt(
      process.env.REQUEST_SIGNUP_LINK_EXPIRY ?? '1800',
    );

    const codePayload = {
      email: signUpRequest.email,
    };

    const token = jwt.sign(codePayload, process.env.JWT_SECRET as string, {
      expiresIn: expiryDuration,
      subject: signUpRequest.email,
      issuer: process.env.JWT_ISSUER,
    });

    await this.preSignupFn(token, signUpRequest.email);
    return new SignupRequestResponseDto({
      code: token,
      expiry: expiryDuration,
      email: signUpRequest.email,
    });
  }

  @authenticate(
    STRATEGY.BEARER,
    {},
    undefined,
    VerifyBindings.BEARER_SIGNUP_VERIFY_PROVIDER,
  )
  @authorize({permissions: ['*']})
  @post(`/auth/${basePath}/create-user`, {
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Success Response.',
        content: {
          [CONTENT_TYPE.JSON]: {
            schema: getModelSchemaRef(LocalUserProfileDto),
          },
        },
      },
      ...ErrorCodes,
    },
  })
  async signupWithToken(
    @requestBody()
    req: LocalUserProfileDto,
  ): Promise<SignupWithTokenReponseDto<LocalUserProfileDto>> {
    const user = await this.userSignupFn(req);

    return new SignupWithTokenReponseDto({
      email: req.email,
      user: user,
    });
  }

  @authenticate(
    STRATEGY.BEARER,
    {},
    undefined,
    VerifyBindings.BEARER_SIGNUP_VERIFY_PROVIDER,
  )
  @authorize({permissions: ['*']})
  @get(`/auth/${basePath}/verify-token`, {
    responses: {
      [STATUS_CODE.OK]: {
        description: 'Success Response.',
      },
      ...ErrorCodes,
    },
  })
  async verifyInviteToken(
    @inject(AuthenticationBindings.CURRENT_USER)
    signupUser: SignupRequest,
  ): Promise<SignupRequest> {
    return signupUser;
  }
}