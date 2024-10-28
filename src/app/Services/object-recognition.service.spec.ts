import { TestBed } from '@angular/core/testing';

import { ObjectRecognitionService } from './object-recognition.service';

describe('ObjectRecognitionService', () => {
  let service: ObjectRecognitionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ObjectRecognitionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
